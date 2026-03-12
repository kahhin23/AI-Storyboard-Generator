import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    getDocs,
    query,
    where,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

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
const db = getFirestore(firebaseApp);

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
    },
    saveStoryboard: async (userId, projectData, storyboardHtml, contentType = 'scene') => {
        try {
            const docRef = await addDoc(collection(db, "storyboards"), {
                userId: userId,
                projectName: projectData.name,
                projectType: projectData.type,
                projectGenre: projectData.genre,
                projectLanguage: projectData.language,
                htmlContent: storyboardHtml,
                contentType: contentType,
                createdAt: new Date()
            });
            console.log("Storyboard saved with ID: ", docRef.id);
            return docRef.id;
        } catch (e) {
            console.error("Error saving storyboard: ", e);
            throw e;
        }
    },
    getUserStoryboards: async (userId) => {
        try {
            const q = query(collection(db, "storyboards"),
                where("userId", "==", userId),
                orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);

            const storyboards = [];
            querySnapshot.forEach((doc) => {
                storyboards.push({ id: doc.id, ...doc.data() });
            });
            return storyboards;
        } catch (e) {
            console.error("Error fetching storyboards: ", e);
            throw e;
        }
    },

    saveCharacter: async (userId, character) => {
        try {
            const payload = {
                userId,
                name: character.name || '',
                sex: character.sex || '',
                age: character.age || '',
                traits: character.traits || '',
                background: character.background || '',
                position: character.position || '',
                updatedAt: new Date()
            };

            if (character.id) {
                await updateDoc(doc(db, "characters", character.id), payload);
                return character.id;
            }

            const docRef = await addDoc(collection(db, "characters"), {
                ...payload,
                createdAt: new Date()
            });
            return docRef.id;
        } catch (e) {
            console.error("Error saving character: ", e);
            throw e;
        }
    },

    deleteCharacter: async (characterId) => {
        try {
            await deleteDoc(doc(db, "characters", characterId));
            return true;
        } catch (e) {
            console.error("Error deleting character: ", e);
            throw e;
        }
    },

    getUserCharacters: async (userId) => {
        try {
            const q = query(collection(db, "characters"),
                where("userId", "==", userId),
                orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);

            const characters = [];
            querySnapshot.forEach((docSnap) => {
                characters.push({ id: docSnap.id, ...docSnap.data() });
            });
            return characters;
        } catch (e) {
            console.error("Error fetching characters: ", e);
            throw e;
        }
    }
};
