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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const dbRef = database.ref('BusLocation');

// Initialize Leaflet Map
const map = L.map('map').setView([28.215176984699085, 83.98871119857192], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Variables
const busMarkers = {}; // Store bus markers
const busPaths = {};   // Store polylines for buses
let isTracking = false; // State for tracking
let trackingInterval = null;

// Helper to calculate speed and direction
function calculateSpeedAndDirection(lastLocation, currentLocation) {
    const R = 6371; // Radius of Earth in km
    const lat1 = lastLocation.latitude * Math.PI / 180;
    const lon1 = lastLocation.longitude * Math.PI / 180;
    const lat2 = currentLocation.latitude * Math.PI / 180;
    const lon2 = currentLocation.longitude * Math.PI / 180;

    const deltaLat = lat2 - lat1;
    const deltaLon = lon2 - lon1;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in km

    // Speed in km/h
    const timeDiff = (Date.now() - lastLocation.timestamp) / 1000; // Time difference in seconds
    const speed = (distance / timeDiff) * 3600; // Speed in km/h

    // Direction calculation (bearing)
    const y = Math.sin(deltaLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
    const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; // In degrees

    return { speed, direction: bearing };
}

// Draw Polyline for Each Bus Using Firebase Data
function drawPolyline(busID, locations) {
    // If the bus already has a polyline, remove the previous one
    if (busPaths[busID]) {
        map.removeLayer(busPaths[busID]);
    }

    // Filter out invalid locations (undefined or missing lat/lng)
    const validLocations = locations.filter(loc => loc.latitude !== undefined && loc.longitude !== undefined);

    if (validLocations.length > 0) {
        const pathCoordinates = validLocations.map(loc => [loc.latitude, loc.longitude]);

        const polyline = L.polyline(pathCoordinates, {
            color: 'blue',
            weight: 3,
            opacity: 0.7,
            smoothFactor: 1  // Smooth the line drawing for a continuous effect
        });

        busPaths[busID] = polyline;  // Store the polyline for this bus
        polyline.addTo(map); // Add the polyline to the map
    } else {
        console.warn(`No valid locations found for bus ${busID}`);
    }
}

// Update or Add Marker for a Bus
function updateBusMarker(busID, location) {
    const { latitude, longitude } = location;

    // Validate coordinates before using them
    if (latitude === undefined || longitude === undefined || isNaN(latitude) || isNaN(longitude)) {
        console.error(`Invalid location data for bus ${busID}: latitude: ${latitude}, longitude: ${longitude}`);
        return;
    }

    // If the marker already exists, update its position
    if (busMarkers[busID]) {
        busMarkers[busID].setLatLng([latitude, longitude]); // Update position of existing marker
    } else {
        // Create a new marker if it doesn't exist
        const marker = L.marker([latitude, longitude]).bindPopup(`Bus ID: ${busID}`);
        busMarkers[busID] = marker;
        map.addLayer(marker);
    }
}

// Fetch Locations and Draw Paths for All Buses
function fetchBusLocations() {
    dbRef.once('value', snapshot => {
        const buses = snapshot.val();
        if (!buses) {
            console.warn("No bus data found in Firebase.");
            return;
        }

        Object.keys(buses).forEach(busID => {
            const rawLocations = buses[busID];
            const locations = Object.values(rawLocations)
                .map(item => {
                    if (item && typeof item === 'object') {
                        if ('latitude' in item && 'longitude' in item) {
                            return {
                                latitude: item.latitude,
                                longitude: item.longitude,
                                timestamp: item.timestamp || null, // Include timestamp if available
                            };
                        } else {
                            console.warn('Skipping invalid location entry:', item);
                            return null;
                        }
                    }
                    console.warn('Skipping invalid entry:', item);
                    return null;
                })
                .filter(location => location !== null); // Remove invalid entries
            console.log(`Processed locations for ${busID}:`, locations);
        
            if (locations.length > 0) {
                // Render buses and paths
                renderBusAndPath(busID, locations);
            } else {
                console.warn(`No valid locations for ${busID}`);
            }
        });
        
        
        
    });
}

// Start Tracking Driver's Bus
function startTracking() {
    const driverID = localStorage.getItem('driverID');
    if (!driverID) {
        alert('Driver ID not found. Redirecting to login...');
        window.location.href = '../index.html';
        return;
    }

    if (!trackingInterval && !isTracking) {
        isTracking = true;
        trackingInterval = setInterval(() => updateDriverLocation(driverID), 2000); // Every 2 seconds
    }
}

// Stop Tracking Driver's Bus
function stopTracking() {
    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
        isTracking = false;
        alert("Tracking stopped.");
    }
}

// Update Driver's Location
function updateDriverLocation(driverID) {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        position => {
            const { latitude, longitude } = position.coords;
            const timestamp = Date.now();

            // Update Firebase with driver's current location
            dbRef.child(driverID).child(timestamp).set({
                latitude,
                longitude,
                timestamp
            });

            // Handle the case where the timestamp is part of the data
            if (!Array.isArray(busPaths[driverID])) {
                busPaths[driverID] = []; // Initialize as an array if not already
            }

            busPaths[driverID].push({ latitude, longitude, timestamp });

            // Update marker and polyline on map
            updateBusMarker(driverID, { latitude, longitude });
            drawPolyline(driverID, busPaths[driverID]); // Redraw the polyline smoothly
        },
        error => {
            console.error("Error retrieving location:", error);
        }
    );
}

// Initialize Buttons
document.getElementById('startTracking').addEventListener('click', startTracking);
document.getElementById('stopTracking').addEventListener('click', stopTracking);

// Load Paths on Page Load
window.onload = fetchBusLocations;

// Initialize on Page Load
window.onload = () => {
    const driverID = localStorage.getItem('driverID');
    if (driverID) {
        fetchBusLocations(); // Load all bus paths
    } else {
        alert('No driver ID found. Redirecting to login.');
        window.location.href = '../index.html';
    }
};
function renderBusAndPath(busID, locations) {
    // Clear existing markers and paths for this bus (if necessary)
    if (busMarkers[busID]) {
        map.removeLayer(busMarkers[busID]);
    }
    if (busPaths[busID]) {
        map.removeLayer(busPaths[busID]);
    }

    // Add markers for each location
    locations.forEach(location => {
        L.marker([location.latitude, location.longitude])
            .addTo(map)
            .bindPopup(`Bus ${busID} at ${new Date(location.timestamp).toLocaleTimeString()}`);
    });

    // Draw path
    const latLngs = locations.map(loc => [loc.latitude, loc.longitude]);
    const polyline = L.polyline(latLngs, { color: 'blue' });
    busPaths[busID] = polyline; // Save the path for potential updates
    polyline.addTo(map);
}

