import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyCkWScRcBRZA5QbVYflJzWvDJxY__MbIYM",
    authDomain: "fastchat-b0c51.firebaseapp.com",
    projectId: "fastchat-b0c51",
    storageBucket: "fastchat-b0c51.firebasestorage.app",
    messagingSenderId: "367585885090",
    appId: "1:367585885090:web:e8dc25e8fa3dbf945010fb"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
