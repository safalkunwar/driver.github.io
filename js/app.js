// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBZpFhPq1pFpvTmyndOnA6SRs9_ftb4jfI",
  authDomain: "v-track-gu999.firebaseapp.com",
  databaseURL: "https://v-track-gu999-default-rtdb.firebaseio.com",
  projectId: "v-track-gu999",
  storageBucket: "v-track-gu999.appspot.com",
  messagingSenderId: "1046512747961",
  appId: "1:1046512747961:web:80df40c48bca3159296268",
  measurementId: "G-38X29VT1YT"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const dbRef = database.ref('BusLocation'); // Define dbRef here
// Function to update the bus marker on the map
function updateBusMarker(bus, busId) {
  const { latitude, longitude } = bus; // Extract latitude and longitude from bus data

  // Check if the marker for this bus already exists
  if (busMarkers[busId]) {
      // Update existing marker position
      busMarkers[busId].setLatLng([latitude, longitude]);
  } else {
      // Create a new marker if it doesn't exist
      const newMarker = L.marker([latitude, longitude], {
          icon: L.divIcon({
              html: '🚌', // Bus emoji
              className: 'bus-icon', // Optional: CSS styling
              iconSize: [30, 30]
          })
      }).addTo(map);

      // Store the new marker in the busMarkers object
      busMarkers[busId] = newMarker;
  }
}

// Object to hold markers for each bus ID
const busMarkers = {};
// Initialize the map with an initial view
const map = L.map('map').setView([27.7172, 85.3240], 13); // Centered on a default location
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Variables for tracking
let busMarker = null;
let trackingInterval = null;
let pathCoordinates = []; // Stores previous locations to show the path
let isAutoCentering = true; // Flag to enable or disable auto-centering

// Function to update the bus location
function updateLocation() {
if (!navigator.geolocation) {
  alert('Geolocation is not supported by your browser.');
  return;
}

// Fetch bus locations from Firebase
dbRef.on("value", (snapshot) => {
    snapshot.forEach((childSnapshot) => {
        const bus = childSnapshot.val();
        const busId = childSnapshot.key; // Use the key (bus1, bus2, etc.) as the ID
        updateBusMarker(bus, busId); // Pass both bus data and ID
    });
});

navigator.geolocation.getCurrentPosition(
  position => {
    const { latitude, longitude } = position.coords;
    
    // Update bus marker position with a bus emoji
    if (busMarker) {
      busMarker.setLatLng([latitude, longitude]);
    } else {
      busMarker = L.marker([latitude, longitude], {
        icon: L.divIcon({
          html: '🚌', // Bus emoji
          className: 'bus-icon', // Optional: CSS styling
          iconSize: [30, 30]
        })
      }).addTo(map);
    }

    // Add new location to path coordinates
    pathCoordinates.push([latitude, longitude]);

    // Draw the path line on the map
    L.polyline(pathCoordinates, {
      color: 'blue',
      weight: 3,
      opacity: 0.7
    }).addTo(map);

    // Auto-center map to bus's current location if enabled
    if (isAutoCentering) {
      map.setView([latitude, longitude], 13);
    }

    // Store the location in Firebase under a specific bus ID
    const busId = 'bus3'; // Change this as needed for different buses
    dbRef.child(busId).set({
      latitude: latitude,
      longitude: longitude,
      timestamp: Date.now()
    });
  },
  error => {
    console.error('Error getting location:', error);
  }
);
}

// Function to start tracking
function startTracking() {
if (trackingInterval) return; // Prevent multiple intervals

updateLocation(); // Initial call
trackingInterval = setInterval(updateLocation, 2000); // Update every 2 seconds

document.getElementById('startTrackingButton').disabled = true;
document.getElementById('stopTrackingButton').disabled = false;
}

// Function to stop tracking
function stopTracking() {
clearInterval(trackingInterval);
trackingInterval = null;

document.getElementById('startTrackingButton').disabled = false;
document.getElementById('stopTrackingButton').disabled = true;
}

// Disable auto-centering when the user manually moves the map
map.on('dragstart', () => {
isAutoCentering = false;
});

// Event listeners for buttons
document.getElementById('startTrackingButton').addEventListener('click', startTracking);
document.getElementById('stopTrackingButton').addEventListener('click', stopTracking);