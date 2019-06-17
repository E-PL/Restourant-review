let restaurant;
var newMap;

/**
 * At page load, initialize app
 */
document.addEventListener("DOMContentLoaded", event => {
  DBHelper.initIdb();
  initApp();
});

/**
 * App initialization
 */
initApp = () => {
  // check if the indexedDb already contains restaurants data
  DBHelper.checkRestaurantsDBStatus((error, keys) => {
    // if there is no data in indexedDb, fetch data from API
    if (error) {
      DBHelper.fetchRestaurants((error, data) => {
        // print fetch errors to the console
        if (error) {
          console.log(error);
        }
        // save fetched data to indexedDB
        if (data) {
          DBHelper.saveRestaurants(data, (error, idbOK) => {
            // print indexedDB data to the console
            if (error) {
              console.log(error);
            }
            // wait for indexedDb to be ready, then initialize map and populate page html with indexedDB data
            if (idbOK) {
              localforage.ready().then(() => {
                initMap();
              });
            }
          });
        }
      });
    }
    // if data is already in indexedDB, initialize the map and populate page with indexedDB data
    if (keys) {
      initMap();
    }
  });

  DBHelper.checkReviewsDBStatus((error, keys) => {
    // if they are not, fetch them from API
    if (error) {
      console.log(error);
      console.log("fetching reviews");
      DBHelper.fetchReviews((error, data) => {
        if (error) {
          console.log(error);
        }
        // and save them to IDB
        if (data) {
          DBHelper.saveReviews(data, (error, idbOK) => {
            if (error) {
              console.log(error);
            }
          });
        }
      });
    }
    // if reviews are already cached, print a message to console
    // TODO: remove console.log and think about updating reviews cache instead
    if (keys) {
   
    }
  });
};

/**
 * Initialize leaflet map
 */
initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) {
      // Got an error!
      console.error(error);
    } else {
      self.newMap = L.map("map", {
        center: [restaurant.latlng.lat, restaurant.latlng.lng],
        zoom: 16,
        scrollWheelZoom: false
      });
      L.tileLayer(
        "https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.jpg70?access_token={mapboxToken}",
        {
          mapboxToken:
            "pk.eyJ1IjoiZS1wbCIsImEiOiJjaml6cWUyM2owOXJ0M3ZxZDh0YmQ1ZXF3In0.qSl2KCzS-rv27slYMB6PcA",
          maxZoom: 18,
          attribution:
            'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
            '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
            'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
          id: "mapbox.streets"
        }
      ).addTo(newMap);
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.newMap);
    }
  });
};

/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = callback => {
  if (self.restaurant) {
    // restaurant already fetched!
    callback(null, self.restaurant);
    return;
  }
  const id = getParameterByName("id");
  if (!id) {
    // no id found in URL
    error = "No restaurant id in URL";
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();

      DBHelper.findReviewsByRestaurantId(id, (error, reviews) => {
        if (error) {
          console.log(error);
        }
        if (reviews) {
          self.reviews = reviews;
          // fill reviews
          fillReviewsHTML();
        }
      });
      DBHelper.fetchRestaurantIsStarredByID(id, (error, isStarred) => {
        if (error) {
          isStarred = false;
          console.log(error);
        }

        if (isStarred != undefined) {
          if (isStarred == true) {
            lightTheStarUp();
          }
        }
      });

      callback(null, restaurant);
    });
  }
};

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById("restaurant-name");
  name.innerHTML = restaurant.name;

  // toggle favorite star
  let star = document.getElementById("star");
  if (restaurant.is_favorite === "true" || restaurant.is_favorite === true) {
  
    star.classList.toggle("lightened");
  }
  star.addEventListener("click", e => {
    toggleFavorite(restaurant.name);
  });

  const address = document.getElementById("restaurant-address");
  address.innerHTML = restaurant.address;

  const image = document.getElementById("restaurant-img");
  image.className = "restaurant-img";
  image.src = DBHelper.imageUrlForRestaurant(restaurant) + ".jpg";
  // add alt to images
  image.alt = "A picture of " + restaurant.name;
  const cuisine = document.getElementById("restaurant-cuisine");
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
};

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (
  operatingHours = self.restaurant.operating_hours
) => {
  const hours = document.getElementById("restaurant-hours");

  for (let key in operatingHours) {
    const row = document.createElement("tr");

    const day = document.createElement("td");
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement("td");
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
};

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (reviews = self.reviews) => {
  const container = document.getElementById("reviews-container");
  const title = document.createElement("h3");
  title.innerHTML = "Reviews";
  container.appendChild(title);

  if (!reviews) {
    const noReviews = document.createElement("p");
    noReviews.innerHTML = "No reviews yet!";
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById("reviews-list");
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
};

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = review => {
  const li = document.createElement("li");
  // append reviewer name and review date in a div for styling
  const reviewHeadingDiv = document.createElement("div");
  reviewHeadingDiv.classList.add("review-headings");
  // use an heading for the reviewer name
  const name = document.createElement("h4");
  name.innerHTML = review.name;
  // add a class to the review heading
  name.classList.add("reviewer-name");
  reviewHeadingDiv.appendChild(name);

  const date = document.createElement("p");

  let theDate = new Date(review.createdAt);
  date.innerHTML = theDate.toLocaleDateString();

  // add a class to the review date
  date.classList.add("review-date");
  reviewHeadingDiv.appendChild(date);
  li.appendChild(reviewHeadingDiv);

  const rating = document.createElement("h5");
  rating.innerHTML = `Rating: ${review.rating}`;
  // add a class to rating
  rating.classList.add("review-rating");
  li.appendChild(rating);

  const comments = document.createElement("p");
  comments.innerHTML = review.comments;
  // add a class to the review text
  comments.classList.add("review-text");
  li.appendChild(comments);

  return li;
};

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant = self.restaurant) => {
  const breadcrumb = document.getElementById("breadcrumb");
  const li = document.createElement("li");
  const button = document.getElementById("star-li");
  li.innerHTML = restaurant.name;
  breadcrumb.insertBefore(li, button);
};

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, "\\$&");
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return "";
  return decodeURIComponent(results[2].replace(/\+/g, " "));
};

/**
 *  Toggle the favorite star
 */
lightTheStarUp = () => {
  const theStar = document.getElementById("star");
  theStar.classList.toggle("lightened");
};

/**
 *  Star button clicked
 */
toggleFavorite = name => {

  lightTheStarUp();
  DBHelper.saveFavoriteRestaurantToIDB(name, (error, restaurant) => {
    if (error) {
      console.log(error);
      //TODO: add error handling
    }
    if (restaurant) {
      DBHelper.saveFavoriteRestaurantToAPI(restaurant, (error, restaurant) => {
        if (error) {
          console.log(error);
          // TODO: add error handling
        }
        if (restaurant) {
          console.log(restaurant);
        }
      });
    }
  });
};
