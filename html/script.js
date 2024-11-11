// Simulated blockchain-stored hashed passwords for demonstration
const blockchainUsers = {
    'user1': '5f4dcc3b5aa765d61d8327deb882cf99', // password123 hashed
    'user2': '202cb962ac59075b964b07152d234b70', // 123 hashed
};

// Variables for login attempts and session timer
let loginAttempts = 0;
let timer;
let sessionTimeout = 60; // In seconds

// Hashing function for password verification (Simple MD5 for simulation)
function md5Hash(password) {
    // Simulated hash function for demonstration
    return CryptoJS.MD5(password).toString();
}

// Login function
function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const hashedPassword = md5Hash(password);

    // Check if username exists on blockchain and password matches
    if (blockchainUsers[username] === hashedPassword) {
        alert('Login successful!');
        loginAttempts = 0; // Reset login attempts
        startSessionTimer();
    } else {
        loginAttempts++;
        if (loginAttempts > 3) {
            displayWarning();
        } else {
            alert('Incorrect username or password. Try again.');
        }
    }
}

// Display warning after 3 failed attempts
function displayWarning() {
    document.getElementById('warning').style.display = 'block';
    setTimeout(() => {
        loginAttempts = 0; // Reset attempts after cooldown period
        document.getElementById('warning').style.display = 'none';
    }, 3000); // 3-second cooldown
}

// Session timeout function
function startSessionTimer() {
    clearInterval(timer); // Clear any existing timer
    document.getElementById('timer').style.display = 'block';
    let timeLeft = sessionTimeout;

    // Update the timer every second
    timer = setInterval(() => {
        timeLeft--;
        document.getElementById('time-left').innerText = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(timer);
            alert('Session expired. Please login again.');
            logout();
        }
    }, 1000);
}

// Logout function
function logout() {
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('timer').style.display = 'none';
}

// Library for hashing password - add this before using MD5 hashing
const script = document.createElement("script");
script.src = "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.9-1/crypto-js.js";
document.head.appendChild(script);
