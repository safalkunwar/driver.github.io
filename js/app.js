// Firebase Configuration (keep the same)
const firebaseConfig = {
    apiKey: "AIzaSyBZpF...",
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

const dbRef = database.ref('BusLocation');
const sessionRef = database.ref('sessions');

const busMarkers = {};
const busPaths = {}; // Track paths for each bus
const map = L.map('map').setView([27.7172, 85.3240], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let trackingInterval = null;
let previousPosition = null;
let speedDisplay = document.getElementById('speedDisplay');
let isAutoCentering = true;
let isDirectionTracking = false;

// HTML element to display speed
if (!speedDisplay) {
    speedDisplay = document.createElement('div');
    speedDisplay.id = 'speedDisplay';
    speedDisplay.style.position = 'fixed';
    speedDisplay.style.bottom = '10px';
    speedDisplay.style.left = '10px';
    speedDisplay.style.padding = '8px';
    speedDisplay.style.background = 'rgba(255, 255, 255, 0.8)';
    speedDisplay.style.borderRadius = '5px';
    speedDisplay.style.fontSize = '16px';
    document.body.appendChild(speedDisplay);
}

// Function to get driver ID from localStorage
function getDriverID() {
    return localStorage.getItem('driverID');
}

// Function to start tracking without session timeout check
function validateSessionAndTrack() {
    const driverID = getDriverID();
    if (!driverID) {
        console.log("No driver ID found. Redirecting to login.");
        window.location.href = '../index.html';
        return;
    }
    startTracking(driverID);
}

// Start tracking and remove session refresh interval
function startTracking(driverID) {
    if (trackingInterval) return;

    updateLocation(driverID);
    trackingInterval = setInterval(() => updateLocation(driverID), 2000);

    document.getElementById('startTrackingButton').disabled = true;
    document.getElementById('stopTrackingButton').disabled = false;
}

// Update the bus marker and draw path on the map
function updateLocation(driverID) {
    if (!navigator.geolocation) {
        alert('Geolocation not supported by your browser.');
        return;
    }

    navigator.geolocation.watchPosition(
        position => {
            const { latitude, longitude, speed, heading } = position.coords;
            const timestamp = Date.now();

            // Save to Firebase
            dbRef.child(driverID).child(timestamp.toString()).set({
                latitude: latitude,
                longitude: longitude,
                speed: speed, // Store speed
                heading: heading, // Store heading
                timestamp: timestamp
            });

            // Calculate and display speed
            calculateAndDisplaySpeed(speed);
            updateBusMarker({ latitude, longitude, heading }, driverID);
            drawBusPath(driverID, latitude, longitude);
        },
        error => {
            console.error('Error getting location:', error);
        }
    );
}

// Function to calculate speed and display on the map
function calculateAndDisplaySpeed(currentSpeed) {
    const speedInKmh = currentSpeed ? (currentSpeed * 3.6).toFixed(1) : 0;
    speedDisplay.innerText = `Speed: ${speedInKmh} km/h`;
}

// Update or create a bus marker
function updateBusMarker(bus, busId) {
    const { latitude, longitude, heading } = bus;

    if (busMarkers[busId]) {
        busMarkers[busId].setLatLng([latitude, longitude]);

        if (isDirectionTracking && heading !== null) {
            busMarkers[busId].setRotationAngle(heading); // Rotate marker based on heading
        }
    } else {
        const newMarker = L.marker([latitude, longitude], {
            icon: L.divIcon({
                html: '🚌',
                className: 'bus-icon',
                iconSize: [30, 30]
            })
        }).addTo(map);
        busMarkers[busId] = newMarker;
    }
}

// Draws or updates the travel path for each bus
function drawBusPath(busId, latitude, longitude) {
    if (!busPaths[busId]) {
        busPaths[busId] = {
            coordinates: [],
            polyline: null,
            color: 'blue' // Initial color
        };
    }

    // Add the new location to path coordinates
    const pathData = busPaths[busId];
    pathData.coordinates.push([latitude, longitude]);

    // Remove the old polyline
    if (pathData.polyline) {
        map.removeLayer(pathData.polyline);
    }

    // Check for revisited path (simplified overlap check)
    if (pathData.coordinates.length > 1) {
        const [lastLat, lastLng] = pathData.coordinates[pathData.coordinates.length - 2];
        if (Math.abs(lastLat - latitude) < 0.0001 && Math.abs(lastLng - longitude) < 0.0001) {
            pathData.color = pathData.color === 'blue' ? 'green' : 'blue'; // Toggle color
        }
    }

    // Draw the updated path with new color
    pathData.polyline = L.polyline(pathData.coordinates, { color: pathData.color }).addTo(map);

    // Optionally, center the map
    if (isAutoCentering) {
        map.setView([latitude, longitude], map.getZoom());
    }
}

// Function to toggle direction tracking
function toggleDirectionTracking() {
    isDirectionTracking = !isDirectionTracking;
    document.getElementById('directionButton').innerText = isDirectionTracking ? "Stop Direction" : "Show Direction";
}

// Function to stop tracking
function stopTracking() {
    clearInterval(trackingInterval);
    trackingInterval = null;

    document.getElementById('startTrackingButton').disabled = false;
    document.getElementById('stopTrackingButton').disabled = true;
}

// Start tracking on page load
document.addEventListener("DOMContentLoaded", validateSessionAndTrack);

// Event listeners for start/stop tracking buttons
document.getElementById('startTrackingButton').addEventListener('click', validateSessionAndTrack);
document.getElementById('stopTrackingButton').addEventListener('click', stopTracking);

// Add a direction button to toggle direction tracking
const directionPopup = document.getElementById('directionPopup');
const startLocationInput = document.getElementById('startLocation');
const destinationLocationInput = document.getElementById('destinationLocation');
const startSuggestions = document.getElementById('startSuggestions');
const destSuggestions = document.getElementById('destSuggestions');
const useCurrentLocationBtn = document.getElementById('useCurrentLocation');
const getDirectionsBtn = document.getElementById('getDirections');
const closeDirectionPopupBtn = document.getElementById('closeDirectionPopup');
let routeLine;

// Show/Hide Direction Popup
function showDirectionPopup() { directionPopup.style.display = 'block'; }
function hideDirectionPopup() { directionPopup.style.display = 'none'; clearSuggestions(); startLocationInput.value = ''; destinationLocationInput.value = ''; if (routeLine) { map.removeLayer(routeLine); } }

// Event listeners for popup
document.getElementById('directionButton').onclick = showDirectionPopup;
closeDirectionPopupBtn.addEventListener('click', hideDirectionPopup);

// Fetch and display location suggestions
async function fetchSuggestions(query, suggestionList) {
    if (query.length < 3) return;
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await response.json();
    suggestionList.innerHTML = ''; // Clear existing suggestions
    data.forEach(location => {
        const suggestion = document.createElement('li');
        suggestion.textContent = `${location.display_name}`;
        suggestion.onclick = () => { 
            if (suggestionList === startSuggestions) startLocationInput.value = location.display_name;
            else destinationLocationInput.value = location.display_name;
            clearSuggestions();
        };
        suggestionList.appendChild(suggestion);
    });
}

// Clear suggestions
function clearSuggestions() {
    startSuggestions.innerHTML = '';
    destSuggestions.innerHTML = '';
}

// Suggest location while typing
startLocationInput.addEventListener('input', () => fetchSuggestions(startLocationInput.value, startSuggestions));
destinationLocationInput.addEventListener('input', () => fetchSuggestions(destinationLocationInput.value, destSuggestions));

// Use current location for start point
useCurrentLocationBtn.addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords;
        startLocationInput.value = `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`;
        clearSuggestions();
    }, error => { alert("Unable to retrieve your location."); console.error(error); });
});

// Get directions and display route on the map
getDirectionsBtn.addEventListener('click', async () => {
    const startLocation = startLocationInput.value;
    const destination = destinationLocationInput.value;

    if (!startLocation || !destination) {
        alert('Please enter both a starting point and a destination.');
        return;
    }

    const startCoords = await getCoordinates(startLocation);
    const destinationCoords = await getCoordinates(destination);

    if (!startCoords || !destinationCoords) {
        alert('Unable to find one or both of the locations.');
        return;
    }

    if (routeLine) map.removeLayer(routeLine); // Remove previous route if any
    const waypoints = [startCoords, destinationCoords];
    routeLine = L.polyline(waypoints, { color: 'blue', weight: 5, opacity: 0.8 }).addTo(map);
    L.marker(startCoords, { title: 'Start' }).addTo(map).bindPopup("Starting Point").openPopup();
    L.marker(destinationCoords, { title: 'Destination' }).addTo(map).bindPopup("Destination").openPopup();
    map.fitBounds(routeLine.getBounds()); // Center map on route

    hideDirectionPopup();
});

// Helper function to get coordinates for a location
async function getCoordinates(location) {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`);
    const data = await response.json();
    if (data && data.length > 0) {
        const { lat, lon } = data[0];
        return [parseFloat(lat), parseFloat(lon)];
    }
    return null;
}
