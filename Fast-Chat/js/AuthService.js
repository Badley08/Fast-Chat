import { auth, db } from './firebaseConfig.js';
import {
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signInWithRedirect, GoogleAuthProvider, getRedirectResult,
    RecaptchaVerifier, signInWithPhoneNumber, signInAnonymously,
    linkWithCredential, linkWithRedirect, signOut, deleteUser,
    onAuthStateChanged, PhoneAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

export let currentUser = null;
let onAuthStateChangeCallback = null;

export const setAuthStateChangeCallback = (callback) => {
    onAuthStateChangeCallback = callback;
};

// Listen to Auth State
onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
        // Load custom user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            currentUser = {
                uid: firebaseUser.uid,
                username: data.username || 'Utilisateur',
                email: data.email || firebaseUser.email,
                phone: data.phone || firebaseUser.phoneNumber,
                color: data.color || '#1EA7FF',
                icon: data.icon || 'user',
                isAnonymous: firebaseUser.isAnonymous
            };
        } else {
            // Document doesn't exist yet (e.g., initial creation in progress or deleted)
            currentUser = {
                uid: firebaseUser.uid,
                username: firebaseUser.displayName || 'Utilisateur',
                email: firebaseUser.email,
                phone: firebaseUser.phoneNumber,
                color: '#1EA7FF',
                icon: 'user',
                isAnonymous: firebaseUser.isAnonymous
            };
        }
        
        // Update presence to online
        await updateOnlineStatus(true);
    } else {
        currentUser = null;
    }

    if (onAuthStateChangeCallback) {
        onAuthStateChangeCallback(currentUser);
    }
});

// Check redirect results (for Google Auth)
export const checkRedirectResult = async () => {
    try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
            // Check if user doc exists
            const userDoc = await getDoc(doc(db, 'users', result.user.uid));
            if (!userDoc.exists()) {
                // Read username from sessionStorage if available, otherwise use email
                const username = sessionStorage.getItem('pendingAuthUsername') || result.user.displayName || 'Utilisateur';
                const color = sessionStorage.getItem('pendingAuthColor') || '#1EA7FF';

                await setDoc(doc(db, 'users', result.user.uid), {
                    username,
                    email: result.user.email,
                    color,
                    icon: 'user',
                    createdAt: serverTimestamp()
                });
                
                sessionStorage.removeItem('pendingAuthUsername');
                sessionStorage.removeItem('pendingAuthColor');
            }
        }
        return result;
    } catch (error) {
        console.error("Redirect Error:", error);
        throw error;
    }
};

export const loginWithEmail = async (email, password) => {
    return await signInWithEmailAndPassword(auth, email, password);
};

export const registerWithEmail = async (email, password, username, color) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), {
        username,
        email,
        color: color || '#1EA7FF',
        icon: 'user',
        createdAt: serverTimestamp()
    });
    return cred;
};

export const loginWithGoogle = async (username, color) => {
    // Store metadata because redirect will reload the page
    if (username) sessionStorage.setItem('pendingAuthUsername', username);
    if (color) sessionStorage.setItem('pendingAuthColor', color);

    const provider = new GoogleAuthProvider();
    // Use Redirect to stay in the same tab as requested
    await signInWithRedirect(auth, provider);
};

export const loginAnonymously = async (username, color) => {
    const cred = await signInAnonymously(auth);
    // Even anonymous users get a profile in DB to use the chat
    await setDoc(doc(db, 'users', cred.user.uid), {
        username,
        color: color || '#1EA7FF',
        icon: 'user-secret',
        createdAt: serverTimestamp()
    });
    return cred;
};

// Phone Auth setup
export const setupRecaptcha = (containerId) => {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
            size: 'invisible'
        });
    }
    return window.recaptchaVerifier;
};

export const sendPhoneCode = async (phoneNumber, appVerifier) => {
    // Note: Dominican Republic is +1, so we should prefix it in UI
    window.confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    return window.confirmationResult;
};

export const verifyPhoneCode = async (code, username, color) => {
    if (!window.confirmationResult) throw new Error("No pending confirmation.");
    
    // Check if we are linking or signing in
    let result;
    if (auth.currentUser && auth.currentUser.isAnonymous) {
        const credential = PhoneAuthProvider.credential(window.confirmationResult.verificationId, code);
        result = await linkWithCredential(auth.currentUser, credential);
        // Update doc
        await updateDoc(doc(db, 'users', result.user.uid), {
            phone: result.user.phoneNumber,
            isAnonymous: false
        });
    } else {
        result = await window.confirmationResult.confirm(code);
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', result.user.uid), {
                username,
                phone: result.user.phoneNumber,
                color: color || '#1EA7FF',
                icon: 'user',
                createdAt: serverTimestamp()
            });
        }
    }
    return result;
};

// Account Linking for Google
export const linkAnonymousWithGoogle = async () => {
    if (!auth.currentUser || !auth.currentUser.isAnonymous) throw new Error("Not an anonymous user.");
    const provider = new GoogleAuthProvider();
    await linkWithRedirect(auth.currentUser, provider);
};

export const updateOnlineStatus = async (isOnline) => {
    if (!currentUser || !currentUser.uid) return;
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            online: isOnline,
            lastSeen: serverTimestamp()
        });
    } catch (err) {
        console.error("Could not update online status", err);
    }
};

export const logout = async () => {
    await updateOnlineStatus(false);
    await signOut(auth);
};

export const deleteCurrentUser = async () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    await updateOnlineStatus(false);
    // Firestore security rules should allow deleting own doc
    try {
        await fetch(`https://firestore.googleapis.com/v1/projects/fastchat-b0c51/databases/(default)/documents/users/${uid}`, { method: 'DELETE' });
    } catch (e) { } // Silent fallback
    await deleteUser(auth.currentUser);
};
