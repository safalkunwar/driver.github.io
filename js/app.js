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

// Start Tracking function
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

// Update location and display on map
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

// Calculate speed and display it on the map
function calculateAndDisplaySpeed(currentSpeed) {
    const speedInKmh = currentSpeed ? (currentSpeed * 3.6).toFixed(1) : 0;
    speedDisplay.innerText = `Speed: ${speedInKmh} km/h`;
}

// Stop Tracking function
function stopTracking() {
    clearInterval(trackingInterval);
    trackingInterval = null;

    document.getElementById('startTrackingButton').disabled = false;
    document.getElementById('stopTrackingButton').disabled = true;
}

// Direction popup toggle function
function toggleDirectionPopup() {
    const directionPopup = document.getElementById('directionPopup');
    directionPopup.style.display = directionPopup.style.display === 'none' ? 'block' : 'none';
}

// Get directions (placeholder logic)
function getDirections() {
    const startLocation = document.getElementById('startLocation').value;
    const destinationLocation = document.getElementById('destinationLocation').value;

    if (!startLocation || !destinationLocation) {
        alert('Please enter both start and destination locations.');
        return;
    }

    alert(`Getting directions from ${startLocation} to ${destinationLocation}.`);
}

document.addEventListener("DOMContentLoaded", () => {
    const startTrackingBtn = document.getElementById("startTrackingButton");
    const stopTrackingBtn = document.getElementById("stopTrackingButton");
    const getDirectionBtn = document.getElementById("directionButton");
    const closeDirectionPopupBtn = document.getElementById("closeDirectionPopup");
    const getDirectionsBtn = document.getElementById("getDirections");

    // Only add event listeners to buttons that are found in the DOM
    if (startTrackingBtn && stopTrackingBtn && getDirectionBtn && closeDirectionPopupBtn && getDirectionsBtn) {
        startTrackingBtn.addEventListener("click", startTracking);
        stopTrackingBtn.addEventListener("click", stopTracking);
        getDirectionBtn.addEventListener("click", toggleDirectionPopup);
        getDirectionsBtn.addEventListener("click", getDirections);
        closeDirectionPopupBtn.addEventListener("click", toggleDirectionPopup);
    } else {
        console.error("One or more required buttons are not found in the DOM.");
    }
});


// Update or create a bus marker on the map
function updateBusMarker(bus, busId) {
    const { latitude, longitude, heading } = bus;

    if (busMarkers[busId]) {
        // Update the existing marker's position
        busMarkers[busId].setLatLng([latitude, longitude]);

        // Rotate the marker based on heading, if available
        if (heading !== null) {
            busMarkers[busId].setRotationAngle(heading);
        }
    } else {
        // Create a new marker if it doesn't exist
        const newMarker = L.marker([latitude, longitude], {
            icon: L.divIcon({
                html: '🚌',
                className: 'bus-icon',
                iconSize: [30, 30]
            })
        }).addTo(map);
        busMarkers[busId] = newMarker;
    }

    // Center map on marker if auto-centering is enabled
    if (isAutoCentering) {
        map.setView([latitude, longitude], map.getZoom());
    }
}

// Draw or update the travel path for each bus
function drawBusPath(busId, latitude, longitude) {
    if (!busPaths[busId]) {
        busPaths[busId] = {
            lastPosition: null,
            segments: [] // Store individual polylines for each segment
        };
    }

    const pathData = busPaths[busId];

    // If this is the first point, just save the position
    if (!pathData.lastPosition) {
        pathData.lastPosition = { latitude, longitude };
        return;
    }

    const { latitude: lastLat, longitude: lastLng } = pathData.lastPosition;

    // Determine the color of the segment based on some condition (e.g., speed)
    const segmentColor = determineSegmentColor(busId, latitude, longitude, lastLat, lastLng);

    // Create a new polyline for the segment
    const segment = L.polyline([[lastLat, lastLng], [latitude, longitude]], {
        color: segmentColor,
        weight: 4, // Set line thickness
    }).addTo(map);

    // Save the segment for future reference
    pathData.segments.push(segment);

    // Update the last position
    pathData.lastPosition = { latitude, longitude };
}

// Function to determine the color of the segment (you can customize this logic)
function determineSegmentColor(busId, latitude, longitude, lastLat, lastLng) {
    const distance = calculateDistance(latitude, longitude, lastLat, lastLng);
    if (distance < 0.01) return 'red'; // Short distance = red
    if (distance < 0.05) return 'orange'; // Moderate distance = orange
    return 'green'; // Long distance = green
}

// Helper function to calculate the distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c / 1000; // Return distance in kilometers
}
