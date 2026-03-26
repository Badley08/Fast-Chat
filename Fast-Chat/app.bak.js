// ════════════════════════════════════════════════
//  FAST-CHAT — app.js
// ════════════════════════════════════════════════

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signInWithPopup, GoogleAuthProvider, RecaptchaVerifier,
    signInWithPhoneNumber, signOut, deleteUser, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import {
    getFirestore, collection, addDoc, query, orderBy, onSnapshot,
    doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
    arrayRemove, arrayUnion, where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// ── Firebase init ──────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyCkWScRcBRZA5QbVYflJzWvDJxY__MbIYM",
    authDomain: "fastchat-b0c51.firebaseapp.com",
    projectId: "fastchat-b0c51",
    storageBucket: "fastchat-b0c51.firebasestorage.app",
    messagingSenderId: "367585885090",
    appId: "1:367585885090:web:e8dc25e8fa3dbf945010fb"
};
const firebaseApp = initializeApp(firebaseConfig);
const auth  = getAuth(firebaseApp);
const db    = getFirestore(firebaseApp);

// ── Receive sound ──────────────────────────────
const receiveSound = new Audio('receive.mp3');
receiveSound.volume = 0.6;

// ── Avatar icon catalogue (Lordicon JSON URLs) ─
const AVATAR_ICONS = [
    { key: 'person',   src: 'https://cdn.lordicon.com/dxjqoygy.json' },
    { key: 'smile',    src: 'https://cdn.lordicon.com/hbathvnb.json' },
    { key: 'star',     src: 'https://cdn.lordicon.com/iltqorsz.json' },
    { key: 'rocket',   src: 'https://cdn.lordicon.com/cnpvyndp.json' },
    { key: 'fire',     src: 'https://cdn.lordicon.com/fhtaantg.json' },
    { key: 'bolt',     src: 'https://cdn.lordicon.com/dgoqydoj.json' },
    { key: 'gem',      src: 'https://cdn.lordicon.com/hpivxauj.json' },
    { key: 'cat',      src: 'https://cdn.lordicon.com/akqdkaqr.json' },
    { key: 'leaf',     src: 'https://cdn.lordicon.com/slduhdil.json' },
    { key: 'planet',   src: 'https://cdn.lordicon.com/fqpqzxmq.json' },
    { key: 'crown',    src: 'https://cdn.lordicon.com/fkjnxqhk.json' },
    { key: 'music',    src: 'https://cdn.lordicon.com/vixtkkbk.json' },
];

const ACCENT_COLORS = [
    '#1EA7FF','#10B981','#F59E0B','#EF4444',
    '#8B5CF6','#EC4899','#00D9FF','#FF006E',
    '#06B6D4','#84CC16',
];

// ── Global state ───────────────────────────────
let currentUser        = null;   // { uid, username, email, color, icon }
let currentChat        = null;   // { id, isGroup, members, name?, ... }
let chatsUnsubscribe   = null;
let messagesUnsubscribe= null;
let typingUnsubscribe  = null;
let authMode           = 'email';
let isLoginMode        = true;
let confirmationResult = null;
let currentTheme       = localStorage.getItem('fc-theme') || 'dark';
let replyToMessage     = null;   // { id, senderName, text }
let ctxTargetMessage   = null;   // message currently right-clicked
let selectedGroupMembers = [];   // for new-group modal
let typingTimeout      = null;

// ── DOM helpers ───────────────────────────────
const $ = id => document.getElementById(id);

// ════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
    // Hide splash after 2.8 s
    setTimeout(() => {
        $('splashScreen').style.display = 'none';
        $('app').classList.remove('hidden');
    }, 2800);

    applyTheme(currentTheme);
    buildAvatarGrids();
    buildColorSwatches();
    setupEventListeners();
    onAuthStateChanged(auth, handleAuthState);

    // Notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

// ════════════════════════════════════════════════
//  THEME
// ════════════════════════════════════════════════
function applyTheme(theme) {
    currentTheme = theme;
    document.body.className = `theme-${theme}`;
    localStorage.setItem('fc-theme', theme);
    document.querySelectorAll('.theme-pill').forEach(b => {
        b.classList.toggle('active', b.dataset.theme === theme);
    });
}

// ════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ════════════════════════════════════════════════
function showToast(msg, type = 'info', duration = 3500) {
    const wrap = $('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => {
        t.classList.add('removing');
        t.addEventListener('animationend', () => t.remove());
    }, duration);
}

// ════════════════════════════════════════════════
//  AVATAR GRID BUILDER
// ════════════════════════════════════════════════
function buildAvatarGrid(containerId, hiddenIconId) {
    const container = $(containerId);
    if (!container) return;
    container.innerHTML = '';
    AVATAR_ICONS.forEach(icon => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'avatar-icon-btn';
        btn.dataset.icon = icon.key;
        btn.innerHTML = `<lord-icon src="${icon.src}" trigger="hover"
            colors="primary:#94A3B8" style="width:28px;height:28px"></lord-icon>`;
        btn.addEventListener('click', () => {
            container.querySelectorAll('.avatar-icon-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (hiddenIconId) $(hiddenIconId).value = icon.key;
        });
        container.appendChild(btn);
    });
    // Activate first
    container.firstChild?.classList.add('active');
}

function buildAvatarGrids() {
    buildAvatarGrid('avatarIconsEmail', 'userIconEmail');
    buildAvatarGrid('avatarIconsSettings', null);
}

// ════════════════════════════════════════════════
//  COLOR SWATCHES BUILDER
// ════════════════════════════════════════════════
function buildColorSwatches() {
    buildSwatches('colorSwatchesEmail',    'userColorEmail');
    buildSwatches('colorSwatchesPhone',    'userColorPhone');
    buildSwatches('colorSwatchesGoogle',   'userColorGoogle');
    buildSwatches('colorSwatchesSettings', null, true);
}

function buildSwatches(containerId, hiddenId, isSettings = false) {
    const container = $(containerId);
    if (!container) return;
    container.innerHTML = '';
    ACCENT_COLORS.forEach((color, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'color-swatch' + (i === 0 ? ' active' : '');
        btn.style.background = color;
        btn.dataset.color = color;
        btn.title = color;
        btn.addEventListener('click', async () => {
            container.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (hiddenId) $(hiddenId).value = color;
            if (isSettings && currentUser) {
                await updateDoc(doc(db,'users',currentUser.uid), { color });
                currentUser.color = color;
                renderSidebarAvatar();
            }
        });
        container.appendChild(btn);
    });
}

function activateSwatch(containerId, color) {
    const container = $(containerId);
    if (!container) return;
    container.querySelectorAll('.color-swatch').forEach(b => {
        b.classList.toggle('active', b.dataset.color === color);
    });
}

// ════════════════════════════════════════════════
//  AVATAR RENDERER (creates a DOM element)
// ════════════════════════════════════════════════
function makeAvatarEl(color, iconKey, size = 42) {
    const iconData = AVATAR_ICONS.find(i => i.key === iconKey) || AVATAR_ICONS[0];
    const div = document.createElement('div');
    div.className = 'avatar';
    div.style.cssText = `background:${color};width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;`;
    div.innerHTML = `<lord-icon src="${iconData.src}" trigger="hover"
        colors="primary:#ffffff" style="width:${Math.round(size*0.55)}px;height:${Math.round(size*0.55)}px"></lord-icon>`;
    return div;
}

function insertAvatar(el, color, iconKey, size = 42) {
    el.innerHTML = '';
    el.appendChild(makeAvatarEl(color, iconKey, size));
}

// ════════════════════════════════════════════════
//  AUTH — event listeners + handlers
// ════════════════════════════════════════════════
function setupEventListeners() {
    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            authMode = btn.dataset.mode;
            document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            switchAuthMode(authMode);
        });
    });

    $('toggleAuthMode').addEventListener('click', toggleAuthMode);
    $('emailAuthForm').addEventListener('submit', handleEmailAuth);
    $('phoneAuthForm').addEventListener('submit', handlePhoneAuth);
    $('phoneVerifyForm').addEventListener('submit', handlePhoneVerify);
    $('googleSignInBtn').addEventListener('click', handleGoogleAuth);

    // Theme pills (auth screen)
    document.querySelectorAll('.auth-theme-row .theme-pill').forEach(b =>
        b.addEventListener('click', () => applyTheme(b.dataset.theme))
    );

    // ── Chat UI ──
    $('searchUserInput').addEventListener('input', debounce(handleSearch, 300));
    $('searchClearBtn').addEventListener('click', clearSearch);
    $('newGroupBtn').addEventListener('click', () => openModal('newGroupModal'));
    $('sendBtn').addEventListener('click', sendMessage);
    $('messageInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    $('messageInput').addEventListener('input', handleTypingIndicator);
    $('backToChats').addEventListener('click', showSidebar);

    // Convo header menu
    $('convoMenuBtn').addEventListener('click', e => {
        e.stopPropagation();
        $('convoDropdown').classList.toggle('hidden');
    });
    $('leaveGroupBtn').addEventListener('click', leaveGroup);
    $('clearChatBtn').addEventListener('click', () => { $('convoDropdown').classList.add('hidden'); });
    $('viewGroupInfoBtn').addEventListener('click', () => {
        $('convoDropdown').classList.add('hidden');
        openGroupInfoModal();
    });

    // Reply bar cancel
    $('cancelReplyBtn').addEventListener('click', cancelReply);

    // Settings
    $('settingsBtn').addEventListener('click', () => openModal('settingsModal'));
    $('closeSettingsModal').addEventListener('click', () => closeModal('settingsModal'));
    $('logoutBtn').addEventListener('click', handleLogout);
    $('deleteAccountBtn').addEventListener('click', handleDeleteAccount);
    document.querySelectorAll('#settingsThemeDark,#settingsThemeGlass').forEach(b =>
        b.addEventListener('click', () => applyTheme(b.dataset.theme))
    );

    // Group modal
    $('closeGroupModal').addEventListener('click', () => closeModal('newGroupModal'));
    $('newGroupForm').addEventListener('submit', createGroup);
    $('groupMemberSearch').addEventListener('input', debounce(() => searchMembersFor('groupMemberResults', 'groupMemberSearch', selectedGroupMembers, addMemberToSelection), 300));

    // Group info modal
    $('closeGroupInfoModal').addEventListener('click', () => closeModal('groupInfoModal'));
    $('addMemberBtn').addEventListener('click', () => $('addMemberSection').classList.toggle('hidden'));
    $('addMemberSearch').addEventListener('input', debounce(() => searchMembersFor('addMemberResults', 'addMemberSearch', [], (user) => addMemberToGroup(user)), 300));

    // Context menu
    $('ctxReply').addEventListener('click', () => {
        if (ctxTargetMessage) startReply(ctxTargetMessage);
        hideContextMenu();
    });
    $('ctxCopy').addEventListener('click', () => {
        if (ctxTargetMessage) navigator.clipboard.writeText(ctxTargetMessage.text).then(() => showToast('Message copié', 'success'));
        hideContextMenu();
    });
    $('ctxDelete').addEventListener('click', () => {
        if (ctxTargetMessage) deleteMessage(ctxTargetMessage.id);
        hideContextMenu();
    });

    // Dismiss context menu & dropdown on outside click
    document.addEventListener('click', e => {
        if (!$('contextMenu').contains(e.target)) hideContextMenu();
        if (!$('convoMenuBtn').contains(e.target) && !$('convoDropdown').contains(e.target))
            $('convoDropdown').classList.add('hidden');
    });

    // Settings avatar grid
    document.addEventListener('click', e => {
        const btn = e.target.closest('#avatarIconsSettings .avatar-icon-btn');
        if (btn && currentUser) {
            const iconKey = btn.dataset.icon;
            updateDoc(doc(db,'users',currentUser.uid), { icon: iconKey });
            currentUser.icon = iconKey;
            renderSidebarAvatar();
        }
    });

    // Attach btn (placeholder)
    $('attachBtn').addEventListener('click', () => showToast('Pièce jointe — bientôt disponible', 'info'));
}

function switchAuthMode(mode) {
    $('emailAuthForm').classList.add('hidden');
    $('phoneAuthForm').classList.add('hidden');
    $('phoneVerifyForm').classList.add('hidden');
    $('googleAuthContainer').classList.add('hidden');
    $({ email:'emailAuthForm', phone:'phoneAuthForm', google:'googleAuthContainer' }[mode])
        .classList.remove('hidden');
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    $('usernameFieldEmail').classList.toggle('hidden', isLoginMode);
    $('avatarPickerEmail').classList.toggle('hidden', isLoginMode);
    $('emailAuthBtnText').textContent = isLoginMode ? 'Se connecter' : "S'inscrire";
    $('toggleAuthMode').textContent  = isLoginMode ? 'Créer un compte' : 'Déjà un compte ?';
}

async function handleEmailAuth(e) {
    e.preventDefault();
    const email    = $('email').value.trim();
    const password = $('password').value;
    const color    = $('userColorEmail').value;
    const iconKey  = $('userIconEmail').value || 'person';
    try {
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            const username = $('usernameEmail').value.trim();
            if (!username) { showToast("Nom d'utilisateur requis", 'error'); return; }
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db,'users',cred.user.uid), {
                username, email, color, icon: iconKey, createdAt: serverTimestamp()
            });
        }
    } catch(err) { showToast(friendlyError(err), 'error'); }
}

async function handlePhoneAuth(e) {
    e.preventDefault();
    const phone = $('phone').value.trim();
    try {
        const rv = new RecaptchaVerifier(auth,'recaptcha-container',{ size:'invisible' });
        confirmationResult = await signInWithPhoneNumber(auth, phone, rv);
        $('phoneAuthForm').classList.add('hidden');
        $('phoneVerifyForm').classList.remove('hidden');
        showToast('Code envoyé !', 'success');
    } catch(err) { showToast(friendlyError(err), 'error'); }
}

async function handlePhoneVerify(e) {
    e.preventDefault();
    const code    = $('verificationCode').value.trim();
    const username= $('usernamePhone').value.trim();
    const color   = $('userColorPhone').value;
    try {
        const result = await confirmationResult.confirm(code);
        const snap = await getDoc(doc(db,'users',result.user.uid));
        if (!snap.exists()) {
            await setDoc(doc(db,'users',result.user.uid), {
                username, phone: $('phone').value, color, icon:'person',
                createdAt: serverTimestamp()
            });
        }
    } catch(err) { showToast(friendlyError(err), 'error'); }
}

async function handleGoogleAuth() {
    const username = $('usernameGoogle').value.trim();
    const color    = $('userColorGoogle').value;
    if (!username) { showToast("Nom d'utilisateur requis", 'error'); return; }
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const snap = await getDoc(doc(db,'users',result.user.uid));
        if (!snap.exists()) {
            await setDoc(doc(db,'users',result.user.uid), {
                username, email: result.user.email, color, icon:'person',
                createdAt: serverTimestamp()
            });
        }
    } catch(err) { showToast(friendlyError(err), 'error'); }
}

// ── Auth state ──
async function handleAuthState(firebaseUser) {
    if (firebaseUser) {
        const snap = await getDoc(doc(db,'users',firebaseUser.uid));
        if (snap.exists()) {
            const d = snap.data();
            currentUser = { uid: firebaseUser.uid, username:d.username, email:d.email||firebaseUser.email, color:d.color||'#1EA7FF', icon:d.icon||'person' };
            showChatScreen();
        } else {
            // User exists in Auth but not Firestore — show auth screen
            showAuthScreen();
        }
    } else {
        currentUser = null;
        showAuthScreen();
    }
}

function showAuthScreen() {
    $('authScreen').classList.remove('hidden');
    $('chatScreen').classList.add('hidden');
}

function showChatScreen() {
    $('authScreen').classList.add('hidden');
    $('chatScreen').classList.remove('hidden');
    renderSidebarAvatar();
    $('settingsUsername').textContent = currentUser.username;
    $('settingsEmail').textContent    = currentUser.email || '';
    activateSwatch('colorSwatchesSettings', currentUser.color);
    // Activate icon in settings grid
    document.querySelectorAll('#avatarIconsSettings .avatar-icon-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.icon === currentUser.icon)
    );
    updateOnlineStatus(true);
    loadChats();
}

function renderSidebarAvatar() {
    const wrap = $('sidebarAvatar');
    insertAvatar(wrap, currentUser.color, currentUser.icon, 38);
    $('sidebarUsername').textContent = currentUser.username;
    // Settings avatar
    insertAvatar($('settingsAvatar'), currentUser.color, currentUser.icon, 56);
}

async function updateOnlineStatus(online) {
    if (!currentUser) return;
    await updateDoc(doc(db,'users',currentUser.uid), {
        online, lastSeen: serverTimestamp()
    }).catch(() => {});
}

async function handleLogout() {
    if (!confirm('Voulez-vous vous déconnecter ?')) return;
    await updateOnlineStatus(false);
    await signOut(auth).catch(err => showToast(err.message,'error'));
    closeModal('settingsModal');
}

async function handleDeleteAccount() {
    if (!confirm('Supprimer définitivement votre compte ?')) return;
    const input = prompt('Tapez SUPPRIMER pour confirmer :');
    if (input !== 'SUPPRIMER') return;
    try {
        await deleteDoc(doc(db,'users',currentUser.uid));
        await deleteUser(auth.currentUser);
        showToast('Compte supprimé','success');
    } catch(err) { showToast(friendlyError(err),'error'); }
}

// ════════════════════════════════════════════════
//  CHAT LIST
// ════════════════════════════════════════════════
function loadChats() {
    if (chatsUnsubscribe) chatsUnsubscribe();
    const q = query(
        collection(db,'chats'),
        where('members','array-contains',currentUser.uid),
        orderBy('lastMessageTime','desc')
    );
    chatsUnsubscribe = onSnapshot(q, async snap => {
        const chatList = $('chatList');
        chatList.innerHTML = '';
        for (const docSnap of snap.docs) {
            const item = await buildChatListItem({ id:docSnap.id, ...docSnap.data() });
            chatList.appendChild(item);
        }
    });
}

async function buildChatListItem(chat) {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.dataset.chatId = chat.id;

    let name='', color='#1EA7FF', iconKey='person';
    if (chat.isGroup) {
        name = chat.name;
        color = '#10B981'; iconKey = 'star';
    } else {
        const otherId = chat.members.find(id => id !== currentUser.uid);
        if (otherId) {
            const u = await getDoc(doc(db,'users',otherId));
            if (u.exists()) { const d=u.data(); name=d.username; color=d.color||'#1EA7FF'; iconKey=d.icon||'person'; }
        }
    }

    const time = chat.lastMessageTime ? formatChatTime(chat.lastMessageTime.toDate()) : '';
    const avatarEl = makeAvatarEl(color, iconKey, 46);

    div.innerHTML = `
        <div class="chat-item-avatar-slot"></div>
        <div class="chat-item-content">
            <div class="chat-item-row">
                <span class="chat-item-name">${escHtml(name)}</span>
                <span class="chat-item-time">${time}</span>
            </div>
            <div class="chat-item-last">${escHtml(chat.lastMessage || 'Aucun message')}</div>
        </div>`;
    div.querySelector('.chat-item-avatar-slot').appendChild(avatarEl);
    div.addEventListener('click', () => openChat({ id:chat.id, name, color, iconKey, isGroup:!!chat.isGroup, members:chat.members, admin:chat.admin }));
    return div;
}

// ════════════════════════════════════════════════
//  OPEN / CLOSE CHAT
// ════════════════════════════════════════════════
function openChat(chat) {
    currentChat = chat;
    // Mark active in list
    document.querySelectorAll('.chat-item').forEach(el => el.classList.toggle('active', el.dataset.chatId === chat.id));
    // Show convo panel (mobile: slide in)
    const panel = $('conversationPanel');
    panel.classList.add('open');
    $('emptyState').classList.add('hidden');
    $('activeChat').classList.remove('hidden');
    $('activeChat').style.display = 'flex';

    // Header
    insertAvatar($('convoAvatar'), chat.color, chat.iconKey, 36);
    $('convoName').textContent = chat.name || '';
    $('convoStatus').textContent = chat.isGroup ? 'Groupe' : '...';
    $('convoStatus').className = 'convo-status';

    // Group-only items
    $('leaveGroupBtn').classList.toggle('hidden', !chat.isGroup);
    $('viewGroupInfoBtn').closest('.dropdown-item')?.classList.toggle('hidden', !chat.isGroup);

    if (!chat.isGroup) loadOtherUserStatus(chat);

    loadMessages();
    cancelReply();
    subscribeTyping();
}

async function loadOtherUserStatus(chat) {
    const otherId = chat.members.find(id => id !== currentUser.uid);
    if (!otherId) return;
    const snap = await getDoc(doc(db,'users',otherId));
    if (snap.exists()) {
        const d = snap.data();
        const el = $('convoStatus');
        if (d.online) { el.textContent = 'En ligne'; el.classList.add('online'); }
        else if (d.lastSeen) { el.textContent = 'Vu ' + formatChatTime(d.lastSeen.toDate()); }
    }
}

function showSidebar() {
    $('conversationPanel').classList.remove('open');
    if (messagesUnsubscribe) { messagesUnsubscribe(); messagesUnsubscribe = null; }
    if (typingUnsubscribe)   { typingUnsubscribe(); typingUnsubscribe = null; }
    currentChat = null;
    cancelReply();
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
}

// ════════════════════════════════════════════════
//  MESSAGES — load & render
// ════════════════════════════════════════════════
function loadMessages() {
    if (messagesUnsubscribe) messagesUnsubscribe();
    const container = $('messagesContainer');
    container.innerHTML = '';

    const q = query(
        collection(db,'chats',currentChat.id,'messages'),
        orderBy('timestamp','asc')
    );

    let lastSenderId = null;
    let lastDateStr  = null;
    let isFirstLoad  = true;

    messagesUnsubscribe = onSnapshot(q, async snap => {
        for (const change of snap.docChanges()) {
            if (change.type === 'added') {
                const data = change.doc.data();
                const msg  = { id: change.doc.id, ...data };

                // Date separator
                const dateStr = msg.timestamp ? formatDateSeparator(msg.timestamp.toDate()) : null;
                if (dateStr && dateStr !== lastDateStr) {
                    container.appendChild(buildDateSeparator(dateStr));
                    lastDateStr = dateStr;
                    lastSenderId = null;
                }

                const isSameAsPrev = msg.senderId === lastSenderId;
                const el = await buildMessageEl(msg, isSameAsPrev);
                container.appendChild(el);
                lastSenderId = msg.senderId;

                // Play sound for new incoming messages (not on initial load)
                const isOwn = msg.senderId === currentUser.uid;
                if (!isFirstLoad && !isOwn) {
                    playReceiveSound();
                    if (Notification.permission === 'granted' && document.hidden) {
                        new Notification('Fast-Chat', {
                            body: `${msg.senderName}: ${msg.text || 'Message supprimé'}`,
                            icon: 'fastchat.png',
                            tag: 'fc-msg'
                        });
                    }
                }

                container.scrollTop = container.scrollHeight;
            }
            if (change.type === 'modified') {
                // Update bubble in-place (for deletions / edits)
                const existing = container.querySelector(`[data-msg-id="${change.doc.id}"]`);
                if (existing) {
                    const data = { id: change.doc.id, ...change.doc.data() };
                    const bubble = existing.querySelector('.msg-bubble');
                    if (bubble) {
                        if (data.deleted) {
                            bubble.className = 'msg-bubble deleted';
                            bubble.textContent = '🚫 Message supprimé';
                        } else {
                            bubble.textContent = data.text;
                        }
                    }
                }
            }
            if (change.type === 'removed') {
                const existing = container.querySelector(`[data-msg-id="${change.doc.id}"]`);
                if (existing) existing.remove();
            }
        }
        isFirstLoad = false;
    });
}

function playReceiveSound() {
    receiveSound.currentTime = 0;
    receiveSound.play().catch(() => {});
}

function buildDateSeparator(label) {
    const div = document.createElement('div');
    div.className = 'date-separator';
    div.innerHTML = `<span>${label}</span>`;
    return div;
}

async function buildMessageEl(msg, isSameAsPrev) {
    const isOwn = msg.senderId === currentUser.uid;
    const row   = document.createElement('div');
    row.className = `message${isOwn ? ' own' : ''}${isSameAsPrev ? ' no-avatar' : ''}`;
    row.dataset.msgId = msg.id;

    // Fetch sender info (color/icon) if not own
    let senderColor = currentUser.color;
    let senderIcon  = currentUser.icon || 'person';
    if (!isOwn) {
        const snap = await getDoc(doc(db,'users',msg.senderId));
        if (snap.exists()) { senderColor = snap.data().color||'#1EA7FF'; senderIcon = snap.data().icon||'person'; }
    }

    // Avatar
    const avatarEl = makeAvatarEl(senderColor, senderIcon, 28);
    avatarEl.className = 'msg-avatar';

    // Group content
    const group = document.createElement('div');
    group.className = 'message-group';

    // Sender name (group chats, incoming)
    if (!isOwn && currentChat.isGroup && !isSameAsPrev) {
        const name = document.createElement('div');
        name.className = 'msg-sender-name';
        name.style.color = senderColor;
        name.textContent = msg.senderName;
        group.appendChild(name);
    }

    // Reply preview
    if (msg.replyTo) {
        const prev = document.createElement('div');
        prev.className = 'msg-reply-preview';
        prev.innerHTML = `<div class="msg-reply-author">${escHtml(msg.replyTo.senderName)}</div>
            <div class="msg-reply-text">${escHtml(msg.replyTo.text)}</div>`;
        group.appendChild(prev);
    }

    // Bubble
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble' + (msg.deleted ? ' deleted' : '');
    bubble.textContent = msg.deleted ? '🚫 Message supprimé' : (msg.text || '');
    bubble.dataset.msgId = msg.id;

    if (!msg.deleted) {
        // Context menu trigger
        bubble.addEventListener('contextmenu', e => {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, { id: msg.id, text: msg.text, senderName: msg.senderName, senderId: msg.senderId });
        });
        // Long press for mobile
        let longPressTimer;
        bubble.addEventListener('touchstart', e => {
            longPressTimer = setTimeout(() => {
                const t = e.touches[0];
                showContextMenu(t.clientX, t.clientY, { id: msg.id, text: msg.text, senderName: msg.senderName, senderId: msg.senderId });
            }, 500);
        }, { passive: true });
        bubble.addEventListener('touchend', () => clearTimeout(longPressTimer));
    }

    group.appendChild(bubble);

    // Time + read receipts
    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : 'Maintenant';
    meta.innerHTML = `<span class="msg-time">${time}</span>`;
    if (isOwn && !msg.deleted) {
        const readBy = msg.readBy || [];
        const allRead = currentChat.members && readBy.length >= currentChat.members.length - 1;
        meta.innerHTML += `<span class="read-receipts"><lord-icon src="${allRead
            ? 'https://cdn.lordicon.com/lomfljuq.json'
            : 'https://cdn.lordicon.com/qjxbmwvd.json'}"
            trigger="hover" colors="primary:${allRead ? '#1EA7FF' : '#94A3B8'}"
            style="width:14px;height:14px"></lord-icon></span>`;
    }
    group.appendChild(meta);

    row.appendChild(avatarEl);
    row.appendChild(group);
    return row;
}

// ════════════════════════════════════════════════
//  SEND MESSAGE
// ════════════════════════════════════════════════
async function sendMessage() {
    const text = $('messageInput').value.trim();
    if (!text || !currentChat) return;
    $('messageInput').value = '';

    const payload = {
        text,
        senderId:   currentUser.uid,
        senderName: currentUser.username,
        timestamp:  serverTimestamp(),
        deleted:    false,
        readBy:     [currentUser.uid],
    };
    if (replyToMessage) {
        payload.replyTo = { id: replyToMessage.id, senderName: replyToMessage.senderName, text: replyToMessage.text };
        cancelReply();
    }

    try {
        await addDoc(collection(db,'chats',currentChat.id,'messages'), payload);
        await updateDoc(doc(db,'chats',currentChat.id), {
            lastMessage: text, lastMessageTime: serverTimestamp()
        });
        // Clear typing
        updateDoc(doc(db,'typing',currentChat.id), { [currentUser.uid]: false }).catch(()=>{});
    } catch(err) { showToast(friendlyError(err),'error'); }
}

// ════════════════════════════════════════════════
//  DELETE MESSAGE
// ════════════════════════════════════════════════
async function deleteMessage(msgId) {
    if (!currentChat) return;
    if (!confirm('Supprimer ce message ?')) return;
    try {
        await updateDoc(doc(db,'chats',currentChat.id,'messages',msgId), {
            deleted: true, text: ''
        });
    } catch(err) { showToast(friendlyError(err),'error'); }
}

// ════════════════════════════════════════════════
//  REPLY
// ════════════════════════════════════════════════
function startReply(msg) {
    replyToMessage = msg;
    $('replyBar').classList.remove('hidden');
    $('replyBarAuthor').textContent = msg.senderName;
    $('replyBarText').textContent   = msg.text;
    $('messageInput').focus();
}
function cancelReply() {
    replyToMessage = null;
    $('replyBar').classList.add('hidden');
    $('replyBarAuthor').textContent = '';
    $('replyBarText').textContent   = '';
}

// ════════════════════════════════════════════════
//  CONTEXT MENU
// ════════════════════════════════════════════════
function showContextMenu(x, y, msg) {
    ctxTargetMessage = msg;
    const menu = $('contextMenu');
    menu.classList.remove('hidden');

    // Show delete only if own message
    $('ctxDelete').classList.toggle('hidden', msg.senderId !== currentUser.uid);

    // Position
    const vw = window.innerWidth, vh = window.innerHeight;
    const mw = 200, mh = 130;
    menu.style.left = `${Math.min(x, vw - mw - 8)}px`;
    menu.style.top  = `${Math.min(y, vh - mh - 8)}px`;
}
function hideContextMenu() {
    $('contextMenu').classList.add('hidden');
    ctxTargetMessage = null;
}

// ════════════════════════════════════════════════
//  TYPING INDICATOR
// ════════════════════════════════════════════════
function handleTypingIndicator() {
    if (!currentChat || !currentUser) return;
    clearTimeout(typingTimeout);
    setDoc(doc(db,'typing',currentChat.id), { [currentUser.uid]: true }, { merge: true }).catch(()=>{});
    typingTimeout = setTimeout(() => {
        updateDoc(doc(db,'typing',currentChat.id), { [currentUser.uid]: false }).catch(()=>{});
    }, 3000);
}

function subscribeTyping() {
    if (typingUnsubscribe) typingUnsubscribe();
    if (!currentChat) return;
    typingUnsubscribe = onSnapshot(doc(db,'typing',currentChat.id), snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        const typers = Object.entries(data)
            .filter(([uid, v]) => uid !== currentUser.uid && v)
            .map(([uid]) => uid);

        const indicator = $('typingIndicator');
        if (typers.length === 0) { indicator.classList.add('hidden'); return; }
        indicator.classList.remove('hidden');
        $('typingText').textContent = typers.length === 1 ? 'en train d\'écrire…' : `${typers.length} personnes écrivent…`;
    });
}

// ════════════════════════════════════════════════
//  SEARCH USERS
// ════════════════════════════════════════════════
async function handleSearch() {
    const term = $('searchUserInput').value.trim().toLowerCase();
    const clearBtn = $('searchClearBtn');
    clearBtn.classList.toggle('hidden', !term);

    if (!term) { clearSearch(); return; }

    const snap = await getDocs(collection(db,'users'));
    const found = [];
    snap.forEach(d => {
        if (d.id !== currentUser.uid && d.data().username?.toLowerCase().includes(term))
            found.push({ id: d.id, ...d.data() });
    });
    renderSearchResults(found);
}

function renderSearchResults(users) {
    const box = $('searchResults');
    box.innerHTML = '';
    if (!users.length) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    users.forEach(u => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        const av = makeAvatarEl(u.color||'#1EA7FF', u.icon||'person', 36);
        const nameEl = document.createElement('span');
        nameEl.className = 'search-result-name';
        nameEl.textContent = u.username;
        item.appendChild(av); item.appendChild(nameEl);
        item.addEventListener('click', () => { startDirectChat(u); clearSearch(); });
        box.appendChild(item);
    });
}

function clearSearch() {
    $('searchUserInput').value = '';
    $('searchResults').innerHTML = '';
    $('searchResults').classList.add('hidden');
    $('searchClearBtn').classList.add('hidden');
}

async function startDirectChat(targetUser) {
    // Find existing or create new
    const q = query(collection(db,'chats'), where('members','array-contains',currentUser.uid));
    const snap = await getDocs(q);
    let existing = null;
    snap.forEach(d => {
        const data = d.data();
        if (!data.isGroup && data.members.includes(targetUser.id))
            existing = { id: d.id, ...data };
    });

    if (existing) {
        openChat({ id: existing.id, name: targetUser.username, color: targetUser.color||'#1EA7FF',
            iconKey: targetUser.icon||'person', isGroup: false, members: existing.members });
    } else {
        const ref = await addDoc(collection(db,'chats'), {
            members: [currentUser.uid, targetUser.id],
            isGroup: false, lastMessage: '', lastMessageTime: serverTimestamp()
        });
        openChat({ id: ref.id, name: targetUser.username, color: targetUser.color||'#1EA7FF',
            iconKey: targetUser.icon||'person', isGroup: false, members: [currentUser.uid, targetUser.id] });
    }
}

// ════════════════════════════════════════════════
//  GROUPS
// ════════════════════════════════════════════════
async function createGroup(e) {
    e.preventDefault();
    const name = $('groupNameInput').value.trim();
    if (!name) return;
    const memberIds = [currentUser.uid, ...selectedGroupMembers.map(u => u.id)];
    try {
        const ref = await addDoc(collection(db,'chats'), {
            name, members: memberIds, isGroup: true,
            admin: currentUser.uid, lastMessage: '', lastMessageTime: serverTimestamp()
        });
        closeModal('newGroupModal');
        $('groupNameInput').value = '';
        selectedGroupMembers = [];
        $('selectedMembers').innerHTML = '';
        showToast(`Groupe "${name}" créé !`, 'success');
        openChat({ id: ref.id, name, color:'#10B981', iconKey:'star', isGroup: true, members: memberIds, admin: currentUser.uid });
    } catch(err) { showToast(friendlyError(err),'error'); }
}

async function leaveGroup() {
    if (!currentChat?.isGroup) return;
    if (!confirm('Quitter ce groupe ?')) return;
    $('convoDropdown').classList.add('hidden');
    try {
        await updateDoc(doc(db,'chats',currentChat.id), { members: arrayRemove(currentUser.uid) });
        showSidebar();
        showToast('Vous avez quitté le groupe','info');
    } catch(err) { showToast(friendlyError(err),'error'); }
}

async function openGroupInfoModal() {
    const snap = await getDoc(doc(db,'chats',currentChat.id));
    if (!snap.exists()) return;
    const data = snap.data();
    const members = data.members || [];
    const isAdmin = data.admin === currentUser.uid;

    const content = $('groupInfoContent');
    content.innerHTML = '';
    for (const uid of members) {
        const uSnap = await getDoc(doc(db,'users',uid));
        if (!uSnap.exists()) continue;
        const u = uSnap.data();

        const wrapper = document.createElement('div');
        wrapper.className = 'group-member-row';

        // Avatar
        wrapper.appendChild(makeAvatarEl(u.color||'#1EA7FF', u.icon||'person', 36));

        // Name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'group-member-name';
        nameSpan.textContent = u.username;
        wrapper.appendChild(nameSpan);

        // Admin badge
        if (uid === data.admin) {
            const badge = document.createElement('span');
            badge.className = 'group-member-badge';
            badge.textContent = 'Admin';
            wrapper.appendChild(badge);
        }

        // Remove button (admin only, not self)
        if (isAdmin && uid !== currentUser.uid) {
            const btn = document.createElement('button');
            btn.className = 'btn-remove-member';
            btn.textContent = 'Retirer';
            btn.addEventListener('click', () => removeMemberFromGroup(uid));
            wrapper.appendChild(btn);
        }

        content.appendChild(wrapper);
    }

    openModal('groupInfoModal');
    $('addMemberSection').classList.add('hidden');
}

async function removeMemberFromGroup(uid) {
    if (!confirm('Retirer ce membre du groupe ?')) return;
    await updateDoc(doc(db,'chats',currentChat.id), { members: arrayRemove(uid) });
    closeModal('groupInfoModal');
    showToast('Membre retiré','success');
}

async function addMemberToGroup(user) {
    await updateDoc(doc(db,'chats',currentChat.id), { members: arrayUnion(user.id) });
    closeModal('groupInfoModal');
    showToast(`${user.username} ajouté au groupe`,'success');
}

// ── Member search (shared for group create + add) ──
async function searchMembersFor(resultsId, inputId, excludeList, onSelect) {
    const term = $(inputId).value.trim().toLowerCase();
    const box  = $(resultsId);
    if (!term) { box.classList.add('hidden'); return; }

    const snap = await getDocs(collection(db,'users'));
    const found = [];
    snap.forEach(d => {
        const excludeIds = [currentUser.uid, ...excludeList.map(u=>u.id)];
        if (!excludeIds.includes(d.id) && d.data().username?.toLowerCase().includes(term))
            found.push({ id: d.id, ...d.data() });
    });

    box.innerHTML = '';
    if (!found.length) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    found.forEach(u => {
        const item = document.createElement('div');
        item.className = 'member-result-item';
        const av = makeAvatarEl(u.color||'#1EA7FF', u.icon||'person', 30);
        item.appendChild(av);
        item.innerHTML += `<span class="member-result-name">${escHtml(u.username)}</span>`;
        item.addEventListener('click', () => { onSelect(u); box.classList.add('hidden'); $(inputId).value=''; });
        box.appendChild(item);
    });
}

function addMemberToSelection(user) {
    if (selectedGroupMembers.find(u => u.id === user.id)) return;
    selectedGroupMembers.push(user);
    renderSelectedMembers();
}

function renderSelectedMembers() {
    const wrap = $('selectedMembers');
    wrap.innerHTML = '';
    selectedGroupMembers.forEach(u => {
        const chip = document.createElement('div');
        chip.className = 'selected-member-chip';
        const av = makeAvatarEl(u.color||'#1EA7FF', u.icon||'person', 22);
        chip.appendChild(av);
        chip.innerHTML += `<span class="chip-name">${escHtml(u.username)}</span>
            <button class="chip-remove" data-id="${u.id}">×</button>`;
        chip.querySelector('.chip-remove').addEventListener('click', () => {
            selectedGroupMembers = selectedGroupMembers.filter(x => x.id !== u.id);
            renderSelectedMembers();
        });
        wrap.appendChild(chip);
    });
}

// ════════════════════════════════════════════════
//  MODAL HELPERS
// ════════════════════════════════════════════════
function openModal(id) {
    $(id).classList.remove('hidden');
    document.body.classList.add('modal-open');
    if (id === 'groupInfoModal') $('groupInfoContent').innerHTML = '';
}
function closeModal(id) {
    $(id).classList.add('hidden');
    document.body.classList.remove('modal-open');
}

// Click outside sheet to close
document.addEventListener('click', e => {
    ['settingsModal','newGroupModal','groupInfoModal'].forEach(id => {
        const el = $(id);
        if (!el || el.classList.contains('hidden')) return;
        if (e.target === el) closeModal(id);
    });
});

// ════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ════════════════════════════════════════════════
function escHtml(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatChatTime(date) {
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'maintenant';
    if (diff < 86400000*1 && date.getDate() === now.getDate()) return date.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    if (diff < 86400000*2) return 'Hier';
    return date.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
}

function formatDateSeparator(date) {
    const now = new Date();
    const diff = (now.setHours(0,0,0,0)) - (new Date(date).setHours(0,0,0,0));
    if (diff === 0) return "Aujourd'hui";
    if (diff === 86400000) return 'Hier';
    return date.toLocaleDateString('fr-FR',{weekday:'long', day:'numeric', month:'long'});
}

function friendlyError(err) {
    const map = {
        'auth/user-not-found':'Utilisateur introuvable.',
        'auth/wrong-password':'Mot de passe incorrect.',
        'auth/email-already-in-use':'Email déjà utilisé.',
        'auth/weak-password':'Mot de passe trop faible (6 caractères min).',
        'auth/invalid-email':'Adresse email invalide.',
        'auth/network-request-failed':'Problème de connexion réseau.',
        'auth/too-many-requests':'Trop de tentatives. Réessayez plus tard.',
    };
    return map[err.code] || err.message || 'Une erreur est survenue.';
}

function debounce(fn, wait) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
}

// ── Mark messages as read when conversation is open ──
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentChat && currentUser) markMessagesRead();
});
async function markMessagesRead() {
    const q = query(
        collection(db,'chats',currentChat.id,'messages'),
        where('readBy','array-contains-any', [currentUser.uid]),
        orderBy('timestamp','desc')
    );
    // lighter approach: just mark last few unread
    const snap = await getDocs(query(
        collection(db,'chats',currentChat.id,'messages'),
        orderBy('timestamp','desc')
    )).catch(()=>null);
    if (!snap) return;
    snap.docs.slice(0,20).forEach(d => {
        const data = d.data();
        if (!data.deleted && data.senderId !== currentUser.uid && !(data.readBy||[]).includes(currentUser.uid)) {
            updateDoc(d.ref, { readBy: arrayUnion(currentUser.uid) }).catch(()=>{});
        }
    });
}

// ── Online status on page unload ──
window.addEventListener('beforeunload', () => {
    if (currentUser) updateOnlineStatus(false);
});
