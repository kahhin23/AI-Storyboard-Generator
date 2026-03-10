import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyB1_ft77gPzGdEhASxFImlRFQsmMzgBVo0",
    authDomain: "storyboard-database-d0857.firebaseapp.com",
    projectId: "storyboard-database-d0857",
    storageBucket: "storyboard-database-d0857.firebasestorage.app",
    messagingSenderId: "823909108661",
    appId: "1:823909108661:web:39c05d00e54c61c56f67fc",
    measurementId: "G-GE2WN6RGN0"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const analytics = getAnalytics(firebaseApp);
const auth = getAuth(firebaseApp);
const provider = new GoogleAuthProvider();

// Expose minimal API to global state so app.js and HTML can use it
window.firebaseAuthAPI = {
    signIn: async () => {
        try {
            document.getElementById('btn-google-login').classList.add('loading');
            const result = await signInWithPopup(auth, provider);
            console.log("Logged in as:", result.user.displayName);
            document.getElementById('btn-google-login').classList.remove('loading');
            return result.user;
        } catch (error) {
            console.error("Login failed:", error);
            document.getElementById('btn-google-login').classList.remove('loading');
            alert("Login Failed: " + error.message);
            throw error;
        }
    },
    signOut: async () => {
        try {
            await signOut(auth);
            console.log("Logged out");
        } catch (error) {
            console.error("Sign out failed:", error);
        }
    },
    initAuthObserver: (onLogin, onLogout) => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // User is signed in.
                onLogin(user);
            } else {
                // User is signed out.
                onLogout();
            }
        });
    }
};
