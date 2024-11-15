// Firebase Configuration
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
let isAutoCentering = true;
let speedDisplay = document.getElementById('speedDisplay');
let isDirectionTracking = false;

// Speed display area
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

// Start tracking after session validation
function startTracking() {
    const driverID = localStorage.getItem('driverID');
    if (!driverID) {
        console.log("No driver ID found. Redirecting to login.");
        window.location.href = '../index.html';
        return;
    }

    if (trackingInterval) return; // Prevent multiple intervals

    // Start updating location every 2 seconds
    trackingInterval = setInterval(() => updateLocation(driverID), 2000);

    document.getElementById('startTrackingButton').disabled = true;
    document.getElementById('stopTrackingButton').disabled = false;
}

// Update bus marker and draw path
function updateLocation(driverID) {
    if (!navigator.geolocation) {
        alert('Geolocation not supported by your browser.');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        position => {
            const { latitude, longitude, speed, heading } = position.coords;
            const timestamp = Date.now();

            // Save to Firebase
            dbRef.child(driverID).child(timestamp.toString()).set({
                latitude: latitude,
                longitude: longitude,
                speed: speed,
                heading: heading,
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

// Function to calculate speed and display it on the map
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

    const pathData = busPaths[busId];
    pathData.coordinates.push([latitude, longitude]);

    // Remove old polyline
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

    // Draw updated path with new color
    pathData.polyline = L.polyline(pathData.coordinates, { color: pathData.color }).addTo(map);

    // Optionally, center the map
    if (isAutoCentering) {
        map.setView([latitude, longitude], map.getZoom());
    }
}

// Stop tracking function
function stopTracking() {
    clearInterval(trackingInterval);
    trackingInterval = null;

    document.getElementById('startTrackingButton').disabled = false;
    document.getElementById('stopTrackingButton').disabled = true;
}

// Direction popup toggle
function toggleDirectionPopup() {
    const directionPopup = document.getElementById('directionPopup');
    directionPopup.style.display = directionPopup.style.display === 'none' ? 'block' : 'none';
}

// Get directions based on start and destination locations
function getDirections() {
    const startLocation = document.getElementById('startLocation').value;
    const destinationLocation = document.getElementById('destinationLocation').value;

    if (!startLocation || !destinationLocation) {
        alert('Please enter both start and destination locations.');
        return;
    }

    // Placeholder logic for directions - you can integrate an API like Google Maps here
    alert(`Getting directions from ${startLocation} to ${destinationLocation}.`);
}

// Add event listeners
document.getElementById('startTrackingButton').addEventListener('click', startTracking);
document.getElementById('stopTrackingButton').addEventListener('click', stopTracking);
document.getElementById('directionButton').addEventListener('click', toggleDirectionPopup);
document.getElementById('getDirections').addEventListener('click', getDirections);
document.getElementById('closeDirectionPopup').addEventListener('click', toggleDirectionPopup);

// Auto-center control
document.addEventListener("DOMContentLoaded", () => {
    const startTrackingBtn = document.getElementById("startTracking");
    const stopTrackingBtn = document.getElementById("stopTracking");
    const getDirectionBtn = document.getElementById("getDirection");
    const speedBtn = document.getElementById("speed");

    if (startTrackingBtn && stopTrackingBtn && getDirectionBtn && speedBtn) {
        startTrackingBtn.addEventListener("click", startTracking);
        stopTrackingBtn.addEventListener("click", stopTracking);
        getDirectionBtn.addEventListener("click", getDirection);
        speedBtn.addEventListener("click", getSpeed);
    } else {
        console.error("One or more buttons are not found in the DOM.");
    }
});

