
// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { 
    getAuth, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    signOut,
    deleteUser,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    arrayRemove,
    where,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCkWScRcBRZA5QbVYflJzWvDJxY__MbIYM",
    authDomain: "fastchat-b0c51.firebaseapp.com",
    projectId: "fastchat-b0c51",
    storageBucket: "fastchat-b0c51.firebasestorage.app",
    messagingSenderId: "367585885090",
    appId: "1:367585885090:web:e8dc25e8fa3dbf945010fb",
    measurementId: "G-Z673CPBTSN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global State
let currentUser = null;
let currentChat = null;
let chatsUnsubscribe = null;
let messagesUnsubscribe = null;
let authMode = 'email';
let isLoginMode = true;
let confirmationResult = null;
let emojis = [];
let currentTheme = 'dark';

// DOM Elements
const splashScreen = document.getElementById('splashScreen');
const appContainer = document.getElementById('app');
const authScreen = document.getElementById('authScreen');
const chatScreen = document.getElementById('chatScreen');

// Auth Elements
const authModeButtons = document.querySelectorAll('.auth-mode-btn');
const emailAuthForm = document.getElementById('emailAuthForm');
const phoneAuthForm = document.getElementById('phoneAuthForm');
const phoneVerifyForm = document.getElementById('phoneVerifyForm');
const googleAuthContainer = document.getElementById('googleAuthContainer');
const toggleAuthModeBtn = document.getElementById('toggleAuthMode');
const googleSignInBtn = document.getElementById('googleSignInBtn');

// Color Picker Elements
const colorOptions = document.querySelectorAll('.color-option');
const colorOptionsPhone = document.querySelectorAll('.color-option-phone');
const colorOptionsGoogle = document.querySelectorAll('.color-option-google');
const colorOptionsSettings = document.querySelectorAll('.color-option-settings');

// Chat Elements
const chatListView = document.getElementById('chatListView');
const chatConversationView = document.getElementById('chatConversationView');
const chatList = document.getElementById('chatList');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const backToChatsBtn = document.getElementById('backToChats');
const headerTitle = document.getElementById('headerTitle');
const headerSubtitle = document.getElementById('headerSubtitle');

// Search Elements
const searchUserInput = document.getElementById('searchUserInput');
const searchUserBtn = document.getElementById('searchUserBtn');
const searchResults = document.getElementById('searchResults');

// Group Elements
const newGroupBtn = document.getElementById('newGroupBtn');
const newGroupModal = document.getElementById('newGroupModal');
const closeGroupModal = document.getElementById('closeGroupModal');
const newGroupForm = document.getElementById('newGroupForm');
const leaveGroupBtn = document.getElementById('leaveGroupBtn');

// Settings Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const logoutBtn = document.getElementById('logoutBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const currentUsername = document.getElementById('currentUsername');

// Theme Elements
const themeDarkBtn = document.getElementById('themeDark');
const themeGlassBtn = document.getElementById('themeGlass');
const themeToggle = document.getElementById('themeToggle');

// Emoji Elements
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');

// Initialize App
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        splashScreen.style.display = 'none';
        appContainer.classList.remove('hidden');
    }, 3000);

    // Set initial theme
    setTheme('dark');

    // Load emojis
    loadEmojis();

    // Setup event listeners
    setupEventListeners();

    // Setup auth state listener
    onAuthStateChanged(auth, handleAuthStateChange);
});

// Setup Event Listeners
function setupEventListeners() {
    // Auth mode selection
    authModeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            authMode = btn.dataset.mode;
            authModeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            switchAuthMode(authMode);
        });
    });

    // Color pickers
    setupColorPicker(colorOptions, 'userColorEmail');
    setupColorPicker(colorOptionsPhone, 'userColorPhone');
    setupColorPicker(colorOptionsGoogle, 'userColorGoogle');
    setupColorPicker(colorOptionsSettings, null, true);

    // Auth forms
    emailAuthForm.addEventListener('submit', handleEmailAuth);
    phoneAuthForm.addEventListener('submit', handlePhoneAuth);
    phoneVerifyForm.addEventListener('submit', handlePhoneVerify);
    toggleAuthModeBtn.addEventListener('click', toggleAuthMode);
    googleSignInBtn.addEventListener('click', handleGoogleAuth);

    // Theme switching
    themeDarkBtn.addEventListener('click', () => setTheme('dark'));
    themeGlassBtn.addEventListener('click', () => setTheme('glass'));
    themeToggle.addEventListener('click', toggleTheme);

    // Chat functionality
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    backToChatsBtn.addEventListener('click', showChatList);

    // Search
    searchUserBtn.addEventListener('click', searchUsers);
    searchUserInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchUsers();
    });

    // Group
    newGroupBtn.addEventListener('click', () => newGroupModal.classList.remove('hidden'));
    closeGroupModal.addEventListener('click', () => newGroupModal.classList.add('hidden'));
    newGroupForm.addEventListener('submit', createGroup);
    leaveGroupBtn.addEventListener('click', leaveGroup);

    // Settings
    settingsBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });
    logoutBtn.addEventListener('click', handleLogout);
    deleteAccountBtn.addEventListener('click', handleDeleteAccount);

    // Emoji
    emojiBtn.addEventListener('click', () => {
        emojiPicker.classList.toggle('hidden');
    });

    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
        if (!emojiBtn.contains(e.target) && !emojiPicker.contains(e.target)) {
            emojiPicker.classList.add('hidden');
        }
    });
}

// Setup Color Picker
function setupColorPicker(buttons, hiddenInputId, isSettings = false) {
    buttons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const color = btn.dataset.color;
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (hiddenInputId) {
                document.getElementById(hiddenInputId).value = color;
            }
            
            if (isSettings && currentUser) {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    color: color
                });
                currentUser.color = color;
            }
        });
    });
}

// Switch Auth Mode
function switchAuthMode(mode) {
    emailAuthForm.classList.add('hidden');
    phoneAuthForm.classList.add('hidden');
    phoneVerifyForm.classList.add('hidden');
    googleAuthContainer.classList.add('hidden');

    if (mode === 'email') {
        emailAuthForm.classList.remove('hidden');
    } else if (mode === 'phone') {
        phoneAuthForm.classList.remove('hidden');
    } else if (mode === 'google') {
        googleAuthContainer.classList.remove('hidden');
    }
}

// Toggle Auth Mode (Login/Register)
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const usernameFieldEmail = document.getElementById('usernameFieldEmail');
    const emailAuthBtnText = document.getElementById('emailAuthBtnText');
    
    if (isLoginMode) {
        usernameFieldEmail.classList.add('hidden');
        emailAuthBtnText.textContent = 'Se connecter';
        toggleAuthModeBtn.textContent = 'Créer un compte';
    } else {
        usernameFieldEmail.classList.remove('hidden');
        emailAuthBtnText.textContent = "S'inscrire";
        toggleAuthModeBtn.textContent = 'Déjà un compte?';
    }
}

// Handle Email Auth
async function handleEmailAuth(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const color = document.getElementById('userColorEmail').value;

    try {
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            const username = document.getElementById('usernameEmail').value;
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                username: username,
                email: email,
                color: color,
                createdAt: serverTimestamp()
            });
        }
    } catch (error) {
        alert('Erreur: ' + error.message);
    }
}

// Handle Phone Auth
async function handlePhoneAuth(e) {
    e.preventDefault();
    const phone = document.getElementById('phone').value;
    
    try {
        const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible'
        });
        
        confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
        phoneAuthForm.classList.add('hidden');
        phoneVerifyForm.classList.remove('hidden');
        alert('Code de vérification envoyé!');
    } catch (error) {
        alert('Erreur: ' + error.message);
    }
}

// Handle Phone Verification
async function handlePhoneVerify(e) {
    e.preventDefault();
    const code = document.getElementById('verificationCode').value;
    
    try {
        const result = await confirmationResult.confirm(code);
        const username = document.getElementById('usernamePhone').value;
        const color = document.getElementById('userColorPhone').value;
        const phone = document.getElementById('phone').value;
        
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', result.user.uid), {
                username: username,
                phone: phone,
                color: color,
                createdAt: serverTimestamp()
            });
        }
    } catch (error) {
        alert('Code invalide: ' + error.message);
    }
}

// Handle Google Auth
async function handleGoogleAuth() {
    const username = document.getElementById('usernameGoogle').value;
    const color = document.getElementById('userColorGoogle').value;
    
    if (!username) {
        alert('Veuillez entrer un nom d\'utilisateur');
        return;
    }
    
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', result.user.uid), {
                username: username,
                email: result.user.email,
                color: color,
                createdAt: serverTimestamp()
            });
        }
    } catch (error) {
        alert('Erreur Google Auth: ' + error.message);
    }
}

// Handle Auth State Change
async function handleAuthStateChange(firebaseUser) {
    if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            currentUser = {
                uid: firebaseUser.uid,
                username: userData.username,
                email: userData.email || firebaseUser.email,
                color: userData.color || '#1EA7FF'
            };
            
            // Update settings color picker
            colorOptionsSettings.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.color === currentUser.color) {
                    btn.classList.add('active');
                }
            });
            
            showChatScreen();
            loadChats();
        }
    } else {
        currentUser = null;
        showAuthScreen();
    }
}

// Show Auth Screen
function showAuthScreen() {
    authScreen.classList.remove('hidden');
    chatScreen.classList.add('hidden');
}

// Show Chat Screen
function showChatScreen() {
    authScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    currentUsername.textContent = currentUser.username;
}

// Load Chats
function loadChats() {
    if (chatsUnsubscribe) chatsUnsubscribe();
    
    const q = query(
        collection(db, 'chats'),
        where('members', 'array-contains', currentUser.uid),
        orderBy('lastMessageTime', 'desc')
    );
    
    chatsUnsubscribe = onSnapshot(q, async (snapshot) => {
        chatList.innerHTML = '';
        
        for (const docSnap of snapshot.docs) {
            const chatData = docSnap.data();
            const chatElement = await createChatElement({
                id: docSnap.id,
                ...chatData
            });
            chatList.appendChild(chatElement);
        }
    });
}

// Create Chat Element
async function createChatElement(chat) {
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    chatItem.onclick = () => openChat(chat);
    
    let chatName = '';
    let chatColor = '#1EA7FF';
    
    if (chat.isGroup) {
        chatName = chat.name;
        chatColor = '#10B981';
    } else {
        const otherUserId = chat.members.find(id => id !== currentUser.uid);
        if (otherUserId) {
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            if (userDoc.exists()) {
                chatName = userDoc.data().username;
                chatColor = userDoc.data().color || '#1EA7FF';
            }
        }
    }
    
    chatItem.innerHTML = `
        <div class="chat-item-icon" style="background: ${chatColor};">
            ${chat.isGroup ? 
                '<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>' : 
                '<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>'
            }
        </div>
        <div class="chat-item-content">
            <div class="chat-item-name">${chatName}</div>
            <div class="chat-item-last-message">${chat.lastMessage || 'Aucun message'}</div>
        </div>
    `;
    
    return chatItem;
}

// Open Chat
function openChat(chat) {
    currentChat = chat;
    showChatConversation();
    loadMessages();
    
    // Update header
    if (chat.isGroup) {
        headerTitle.textContent = chat.name;
        headerSubtitle.textContent = 'Groupe';
        leaveGroupBtn.classList.remove('hidden');
    } else {
        getOtherUserInfo(chat).then(otherUser => {
            headerTitle.textContent = otherUser.username;
            headerSubtitle.textContent = 'En ligne';
        });
        leaveGroupBtn.classList.add('hidden');
    }
}

// Get Other User Info
async function getOtherUserInfo(chat) {
    const otherUserId = chat.members.find(id => id !== currentUser.uid);
    if (otherUserId) {
        const userDoc = await getDoc(doc(db, 'users', otherUserId));
        if (userDoc.exists()) {
            return {
                id: otherUserId,
                ...userDoc.data()
            };
        }
    }
    return null;
}

// Load Messages
function loadMessages() {
    if (messagesUnsubscribe) messagesUnsubscribe();
    
    messagesContainer.innerHTML = '';
    
    const q = query(
        collection(db, 'chats', currentChat.id, 'messages'),
        orderBy('timestamp', 'asc')
    );
    
    messagesUnsubscribe = onSnapshot(q, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
            if (change.type === 'added') {
                const messageData = change.doc.data();
                const messageElement = await createMessageElement({
                    id: change.doc.id,
                    ...messageData
                });
                messagesContainer.appendChild(messageElement);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }
    });
}

// Create Message Element
async function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    const isOwn = message.senderId === currentUser.uid;
    messageDiv.className = `message ${isOwn ? 'own' : ''}`;
    
    let senderColor = currentUser.color;
    if (!isOwn) {
        const senderDoc = await getDoc(doc(db, 'users', message.senderId));
        if (senderDoc.exists()) {
            senderColor = senderDoc.data().color || '#1EA7FF';
        }
    }
    
    const time = message.timestamp ? 
        new Date(message.timestamp.toDate()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 
        'Maintenant';
    
    messageDiv.innerHTML = `
        <div class="message-avatar" style="background: ${senderColor};"></div>
        <div class="message-content">
            ${!isOwn && currentChat.isGroup ? `
                <div class="message-sender">
                    <div class="message-sender-color" style="background: ${senderColor};"></div>
                    ${message.senderName}
                </div>
            ` : ''}
            <div class="message-bubble">${message.text}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    return messageDiv;
}

// Send Message
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentChat) return;
    
    try {
        await addDoc(collection(db, 'chats', currentChat.id, 'messages'), {
            text: text,
            senderId: currentUser.uid,
            senderName: currentUser.username,
            timestamp: serverTimestamp()
        });
        
        await updateDoc(doc(db, 'chats', currentChat.id), {
            lastMessage: text,
            lastMessageTime: serverTimestamp()
        });
        
        messageInput.value = '';
        emojiPicker.classList.add('hidden');
    } catch (error) {
        alert('Erreur: ' + error.message);
    }
}

// Search Users
async function searchUsers() {
    const searchTerm = searchUserInput.value.trim().toLowerCase();
    if (!searchTerm) {
        searchResults.classList.add('hidden');
        searchResults.innerHTML = '';
        return;
    }
    
    try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        const foundUsers = [];
        
        snapshot.forEach(doc => {
            const userData = doc.data();
            if (doc.id !== currentUser.uid && 
                userData.username.toLowerCase().includes(searchTerm)) {
                foundUsers.push({
                    id: doc.id,
                    ...userData
                });
            }
        });
        
        displaySearchResults(foundUsers);
    } catch (error) {
        alert('Erreur de recherche: ' + error.message);
    }
}

// Display Search Results
function displaySearchResults(users) {
    searchResults.innerHTML = '';
    
    if (users.length === 0) {
        searchResults.classList.add('hidden');
        return;
    }
    
    searchResults.classList.remove('hidden');
    
    users.forEach(user => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.onclick = () => startChat(user);
        
        resultItem.innerHTML = `
            <div class="search-result-color" style="background: ${user.color || '#1EA7FF'};"></div>
            <div class="search-result-name">${user.username}</div>
        `;
        
        searchResults.appendChild(resultItem);
    });
}

// Start Chat with User
async function startChat(targetUser) {
    try {
        // Check if chat already exists
        const chatsRef = collection(db, 'chats');
        const q = query(chatsRef, where('members', 'array-contains', currentUser.uid));
        const snapshot = await getDocs(q);
        
        let existingChat = null;
        snapshot.forEach(doc => {
            const chatData = doc.data();
            if (!chatData.isGroup && chatData.members.includes(targetUser.id)) {
                existingChat = { id: doc.id, ...chatData };
            }
        });
        
        if (existingChat) {
            openChat(existingChat);
        } else {
            const newChatRef = await addDoc(collection(db, 'chats'), {
                members: [currentUser.uid, targetUser.id],
                isGroup: false,
                lastMessage: '',
                lastMessageTime: serverTimestamp()
            });
            
            openChat({
                id: newChatRef.id,
                members: [currentUser.uid, targetUser.id],
                isGroup: false,
                lastMessage: '',
                lastMessageTime: null
            });
        }
        
        searchUserInput.value = '';
        searchResults.classList.add('hidden');
        searchResults.innerHTML = '';
    } catch (error) {
        alert('Erreur: ' + error.message);
    }
}

// Create Group
async function createGroup(e) {
    e.preventDefault();
    const groupName = document.getElementById('groupNameInput').value.trim();
    
    if (!groupName) return;
    
    try {
        await addDoc(collection(db, 'chats'), {
            name: groupName,
            members: [currentUser.uid],
            isGroup: true,
            admin: currentUser.uid,
            lastMessage: '',
            lastMessageTime: serverTimestamp()
        });
        
        newGroupModal.classList.add('hidden');
        document.getElementById('groupNameInput').value = '';
        alert('Groupe créé avec succès!');
    } catch (error) {
        alert('Erreur: ' + error.message);
    }
}

// Leave Group
async function leaveGroup() {
    if (!currentChat || !currentChat.isGroup) return;
    
    if (confirm('Voulez-vous vraiment quitter ce groupe?')) {
        try {
            await updateDoc(doc(db, 'chats', currentChat.id), {
                members: arrayRemove(currentUser.uid)
            });
            
            showChatList();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }
}

// Show Chat List
function showChatList() {
    chatListView.classList.remove('hidden');
    chatConversationView.classList.add('hidden');
    backToChatsBtn.classList.add('hidden');
    headerTitle.textContent = 'Fast-Chat';
    headerSubtitle.textContent = '';
    currentChat = null;
    
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }
}

// Show Chat Conversation
function showChatConversation() {
    chatListView.classList.add('hidden');
    chatConversationView.classList.remove('hidden');
    backToChatsBtn.classList.remove('hidden');
}

// Handle Logout
async function handleLogout() {
    if (confirm('Voulez-vous vous déconnecter?')) {
        try {
            await signOut(auth);
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }
}

// Handle Delete Account
async function handleDeleteAccount() {
    if (confirm('Êtes-vous sûr de vouloir supprimer votre compte? Cette action est irréversible.')) {
        const confirmation = prompt('Tapez "SUPPRIMER" pour confirmer:');
        if (confirmation === 'SUPPRIMER') {
            try {
                await deleteDoc(doc(db, 'users', currentUser.uid));
                await deleteUser(auth.currentUser);
                alert('Compte supprimé avec succès');
            } catch (error) {
                alert('Erreur: ' + error.message);
            }
        }
    }
}

// Set Theme
function setTheme(theme) {
    currentTheme = theme;
    document.body.className = `theme-${theme}`;
    
    themeDarkBtn.classList.remove('active');
    themeGlassBtn.classList.remove('active');
    
    if (theme === 'dark') {
        themeDarkBtn.classList.add('active');
    } else {
        themeGlassBtn.classList.add('active');
    }
    
    localStorage.setItem('fastchat-theme', theme);
}

// Toggle Theme
function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'glass' : 'dark';
    setTheme(newTheme);
}

// Load Emojis
async function loadEmojis() {
    try {
        const response = await fetch('https://emoji-api.com/emojis?access_key=1f789fc83b83a8cbc0b0f376a3804fe8900f3efb');
        const data = await response.json();
        emojis = data.slice(0, 100);
        renderEmojiPicker();
    } catch (error) {
        console.error('Error loading emojis:', error);
        // Fallback emojis
        emojis = [
            { character: '😀' }, { character: '😃' }, { character: '😄' }, { character: '😁' },
            { character: '😆' }, { character: '😅' }, { character: '🤣' }, { character: '😂' },
            { character: '🙂' }, { character: '😉' }, { character: '😊' }, { character: '😇' },
            { character: '❤️' }, { character: '👍' }, { character: '👎' }, { character: '👏' },
            { character: '🔥' }, { character: '✨' }, { character: '💯' }, { character: '🎉' }
        ];
        renderEmojiPicker();
    }
}

// Render Emoji Picker
function renderEmojiPicker() {
    const emojiGrid = document.createElement('div');
    emojiGrid.className = 'emoji-grid';
    
    emojis.forEach(emoji => {
        const emojiItem = document.createElement('div');
        emojiItem.className = 'emoji-item';
        emojiItem.textContent = emoji.character;
        emojiItem.onclick = () => {
            messageInput.value += emoji.character;
            messageInput.focus();
        };
        emojiGrid.appendChild(emojiItem);
    });
    
    emojiPicker.innerHTML = '';
    emojiPicker.appendChild(emojiGrid);
}

// Quand l'utilisateur tape
messageInput.addEventListener('input', debounce(() => {
    if (currentChat) {
        setDoc(doc(db, 'typing', currentChat.id), {
            [currentUser.uid]: true
        }, { merge: true });
        
        // Supprimer après 3 secondes
        setTimeout(() => {
            updateDoc(doc(db, 'typing', currentChat.id), {
                [currentUser.uid]: false
            });
        }, 3000);
    }
}, 300));

// Écouter les indicateurs de frappe
onSnapshot(doc(db, 'typing', currentChat.id), (doc) => {
    if (doc.exists()) {
        const data = doc.data();
        const isOtherUserTyping = Object.entries(data).some(
            ([uid, isTyping]) => uid !== currentUser.uid && isTyping
        );
        
        if (isOtherUserTyping) {
            headerSubtitle.textContent = 'En train d\'écrire...';
        } else {
            headerSubtitle.textContent = 'En ligne';
        }
    }
});

// Fonction utilitaire debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
// Demander la permission pour les notifications
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Dans loadMessages(), après la réception d'un message
if (messageData.senderId !== currentUser.uid && 
    Notification.permission === 'granted' && 
    document.hidden) {
    
    new Notification('Fast-Chat', {
        body: `${messageData.senderName}: ${messageData.text}`,
        icon: 'fastchat.png',
        tag: 'message-notification'
    });
}

// Load saved theme
const savedTheme = localStorage.getItem('fastchat-theme') || 'dark';
setTheme(savedTheme);
