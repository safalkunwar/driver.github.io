// Firebase Configuration - Replace with your actual Firebase credentials
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
const dbRef = firebase.database().ref();

const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const forgotPasswordForm = document.getElementById("forgot-password-form");
const otpSection = document.getElementById("otp-section");

function showLogin() {
    loginForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
    forgotPasswordForm.classList.add("hidden");
    otpSection.classList.add("hidden");
}

function showSignUp() {
    signupForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    forgotPasswordForm.classList.add("hidden");
}

function showForgotPassword() {
    forgotPasswordForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    otpSection.classList.add("hidden");
}

async function login() {
    const driverID = document.getElementById("login-driverid").value;
    const password = document.getElementById("login-password").value;

    try {
        const snapshot = await dbRef.child("driverInfo").child(driverID).get();
        if (snapshot.exists()) {
            const driverData = snapshot.val();
            if (driverData.password === btoa(password)) {
                const busSnapshot = await dbRef.child("busDetails").child(driverData.busID).get();
                if (busSnapshot.exists()) {
                    // Successfully logged in, store session data
                    const sessionData = {
                        driverID: driverID,
                        busID: driverData.busID,
                        loginTime: new Date().toISOString()  // Store the login time
                    };

                    // Save session data to a temporary session node
                    await dbRef.child("sessions").child(driverID).set(sessionData);
                    localStorage.setItem('driverID', driverID);
                    // Redirect to the driver dashboard
                    window.location.href = "./html/driver-dashboard.html";
                } else {
                    alert("Bus not found for this driver.");
                }
            } else {
                alert("Invalid credentials.");
            }
        } else {
            alert("Driver not found.");
        }
    } catch (error) {
        console.error("Login error:", error);
        alert("Login failed.");
    }
}

async function signUp() {
    const email = document.getElementById("signup-email").value;
    const driverID = document.getElementById("signup-driverid").value;
    const busName = document.getElementById("signup-busname").value;
    const password = document.getElementById("signup-password").value;

    try {
        const busSnapshot = await dbRef.child("busDetails").orderByChild("busName").equalTo(busName).get();
        if (busSnapshot.exists()) {
            const busData = busSnapshot.val();
            const busID = Object.keys(busData)[0];  // Assuming busName is unique
            await dbRef.child("driverInfo").child(driverID).set({
                email: email,
                password: btoa(password),
                busID: busID
            });
            alert("Sign-up successful!");
            showLogin();
        } else {
            console.log("Bus not found for the provided bus name:", busName);
            alert("Bus not found. Please check the bus name.");
        }
    } catch (error) {
        console.error("Sign-up error:", error);
        alert("Sign-up failed. Please try again.");
    }
}

async function sendOTP() {
    const email = document.getElementById("forgot-email").value;
    try {
        await firebase.auth().sendPasswordResetEmail(email);
        alert("An OTP has been sent to your email.");
        otpSection.classList.remove("hidden");
    } catch (error) {
        console.error("Error sending OTP:", error);
        alert("Failed to send OTP.");
    }
}

async function resetPassword() {
    const enteredOtp = document.getElementById("otp-input").value;
    const newPassword = document.getElementById("new-password").value;

    if (enteredOtp && newPassword) {
        try {
            const email = localStorage.getItem("otpEmail");
            const driverSnapshot = await dbRef.child("driverInfo").orderByChild("email").equalTo(email).get();
            if (driverSnapshot.exists()) {
                const driverID = Object.keys(driverSnapshot.val())[0];
                await dbRef.child("driverInfo").child(driverID).update({
                    password: btoa(newPassword)
                });
                alert("Password reset successfully!");
                showLogin();
            } else {
                alert("Driver not found.");
            }
        } catch (error) {
            console.error("Password reset error:", error);
            alert("Failed to reset password.");
        }
    } else {
        alert("Invalid OTP or password.");
    }
}
