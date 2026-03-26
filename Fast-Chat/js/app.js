import { 
    currentUser, setAuthStateChangeCallback, checkRedirectResult,
    loginWithEmail, registerWithEmail, loginWithGoogle,
    loginAnonymously, setupRecaptcha, sendPhoneCode, verifyPhoneCode,
    linkAnonymousWithGoogle, logout
} from './AuthService.js';
import { 
    loadChats, loadMessages, sendMessage, deleteMessage, editMessage,
    createGroup, searchUsers, joinGroupByName, setTypingStatus, listenToTyping
} from './ChatService.js';
import { uploadImage } from './MediaService.js';
import { startCall, leaveCall } from './AgoraService.js';

// ---- UI Elements ----
const $ = id => document.getElementById(id);

let currentChatId = null;
let currentChatType = null; // 'private' or 'group'
let currentChatName = null;
let typingTimeout = null;

// ---- Theme Management ----
let currentTheme = localStorage.getItem('fc-theme') || 'theme-dark';
document.body.className = currentTheme;

$('themeToggleAuth').addEventListener('click', () => {
    currentTheme = currentTheme === 'theme-dark' ? 'theme-midnight' : (currentTheme === 'theme-midnight' ? 'theme-skyblue' : 'theme-dark');
    document.body.className = currentTheme;
    localStorage.setItem('fc-theme', currentTheme);
});

// ---- Initialization ----
document.addEventListener('DOMContentLoaded', async () => {
    setupColorSwatches();
    
    // Auth Tabs
    document.querySelectorAll('#authTabs .btn-icon').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#authTabs .btn-icon').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.auth-box').forEach(box => box.classList.add('hidden'));
            const mode = btn.dataset.mode;
            $(`${mode}Form`).classList.remove('hidden');
            
            if (mode === 'phone') {
                setupRecaptcha('recaptcha-container');
            }
        });
    });

    // Handle Google Redirect Result
    try {
        await checkRedirectResult();
    } catch(err) {
        showToast(err.message, 'error');
    }

    // Set auth callback
    setAuthStateChangeCallback((user) => {
        if (user) {
            showApp();
            renderSidebarInfo();
            // Start listening to chats
            loadChats(renderChatsList);
        } else {
            showAuth();
        }
    });

    // Initial Recaptcha setup for Phone Auth if phone tab was active by default
    // It's hidden by default, skip.
});

// ---- Auth Handlers ----
$('emailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('emailInput').value;
    const pwd = $('passwordInput').value;
    const name = $('emailName').value;
    const color = $('emailColors').dataset.selected || '#1EA7FF';
    
    try {
        if (name) {
            await registerWithEmail(email, pwd, name, color);
        } else {
            await loginWithEmail(email, pwd);
        }
    } catch (err) { showToast(err.message, 'error'); }
});

$('googleBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    const name = $('googleName').value;
    const color = $('googleColors').dataset.selected || '#1EA7FF';
    if (!name && !currentUser) { // Need name for first time
        showToast("Nom d'utilisateur requis pour la première connexion", 'error'); 
        return;
    }
    try {
        await loginWithGoogle(name, color);
    } catch (err) { showToast(err.message, 'error'); }
});

$('anonForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('anonName').value;
    const color = $('anonColors').dataset.selected || '#1EA7FF';
    try {
        await loginAnonymously(name, color);
    } catch (err) { showToast(err.message, 'error'); }
});

$('phoneForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = $('phoneInput').value;
    try {
        await sendPhoneCode(phone, window.recaptchaVerifier);
        $('phoneForm').classList.add('hidden');
        $('phoneVerifyForm').classList.remove('hidden');
        showToast("Code SMS envoyé", "success");
    } catch (err) { showToast(err.message, 'error'); }
});

$('phoneVerifyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('verifyCodeInput').value;
    const name = $('phoneName').value;
    const color = $('phoneColors').dataset.selected || '#1EA7FF';
    try {
        await verifyPhoneCode(code, name, color);
    } catch (err) { showToast(err.message, 'error'); }
});

$('logoutBtn').addEventListener('click', async () => {
    await logout();
});

$('linkAccountBtn').addEventListener('click', async () => {
    try {
        await linkAnonymousWithGoogle();
    } catch (err) { showToast("Erreur de liaison: " + err.message, "error"); }
});

// ---- Nav & UI Logic ----
function showAuth() {
    $('authScreen').classList.remove('hidden');
    $('app').classList.add('hidden');
}

function showApp() {
    $('authScreen').classList.add('hidden');
    $('app').classList.remove('hidden');
}

document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
        
        const tab = el.dataset.tab;
        if (tab === 'settings') {
            $('settingsModal').classList.remove('hidden');
            $('settingsUsername').textContent = currentUser.username;
            $('settingsEmail').textContent = currentUser.email || currentUser.phone || 'Anonyme';
            $('settingsAvatar').style.background = currentUser.color;
            $('settingsAvatar').innerHTML = `<i class="fa-solid fa-${currentUser.icon}"></i>`;
            
            // Show/hide linking button
            if (currentUser.isAnonymous) {
                $('linkAccountBtn').classList.remove('hidden');
            } else {
                $('linkAccountBtn').classList.add('hidden');
            }
        } else if (tab === 'chats') {
            $('sidebarTitle').textContent = 'Discussions';
            $('newActionBtn').innerHTML = '<i class="fa-solid fa-plus"></i>';
            renderChatsList(currentChatsMetadata.filter(c => !c.isGroup));
        } else if (tab === 'groups') {
            $('sidebarTitle').textContent = 'Groupes';
            $('newActionBtn').innerHTML = '<i class="fa-solid fa-users"></i>';
            renderChatsList(currentChatsMetadata.filter(c => c.isGroup));
        }
    });
});

$('newActionBtn').addEventListener('click', () => {
    const tab = document.querySelector('.nav-item.active').dataset.tab;
    if (tab === 'groups') {
        $('groupModal').classList.remove('hidden');
    } else {
        showToast("Recherche des utilisateurs requise. A implémenter.", "info");
    }
});

// Create/Join Group
$('createGroupBtn').addEventListener('click', async () => {
    const name = $('groupNameInput').value;
    if (!name) return;
    try {
        const existing = await joinGroupByName(name);
        if (existing) {
            showToast("Groupe rejoint !", "success");
            openConversation(existing.id, name, 'group');
        } else {
            const id = await createGroup(name, []);
            showToast("Groupe créé !", "success");
            openConversation(id, name, 'group');
        }
        $('groupModal').classList.add('hidden');
    } catch(err) { $('groupError').textContent = err.message; }
});

// ---- Chat Logic ----
let currentChatsMetadata = [];
let recentChatIds = [];

function renderChatsList(chats, pins = null) {
    if (chats) currentChatsMetadata = chats;
    if (pins) recentChatIds = pins;
    
    const tab = document.querySelector('.nav-item.active').dataset.tab;
    let toShow = currentChatsMetadata;
    
    if (tab === 'chats') toShow = currentChatsMetadata.filter(c => !c.isGroup);
    if (tab === 'groups') toShow = currentChatsMetadata.filter(c => c.isGroup);

    const list = $('chatList');
    list.innerHTML = '';
    
    toShow.forEach(c => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        // For private chats, dynamically replace name with the other user's name if we had it. Keeping it simple here.
        div.innerHTML = `
            <div class="chat-avatar" style="background:#1EA7FF"><i class="fa-solid fa-${c.isGroup ? 'users' : 'user'}"></i></div>
            <div class="chat-info">
                <span class="chat-name">${c.name || 'Chat'}</span>
                <span class="chat-last">${c.lastMessage || ''}</span>
            </div>
            ${recentChatIds.includes(c.id) ? '<i class="fa-solid fa-thumbtack text-primary"></i>' : ''}
        `;
        div.onclick = () => openConversation(c.id, c.name || 'Chat', c.isGroup ? 'group' : 'private');
        list.appendChild(div);
    });
}

function openConversation(id, name, type) {
    currentChatId = id;
    currentChatType = type;
    currentChatName = name;
    
    $('emptyConvo').classList.add('hidden');
    $('activeConvo').classList.remove('hidden');
    
    $('convoName').textContent = name;
    $('convoAvatar').innerHTML = `<i class="fa-solid fa-${type === 'group' ? 'users' : 'user'}"></i>`;
    
    // Mobile view handling
    if (window.innerWidth <= 768) {
        $('conversation').classList.add('active-mobile');
    }
    
    // Load messages
    loadMessages(id, renderMessages);
    
    // Listen to typing
    listenToTyping(id, (typingUsers) => {
        const indicator = $('typingIndicator');
        if (typingUsers.length > 0) {
            indicator.textContent = `${typingUsers.join(', ')} écrit...`;
            indicator.classList.remove('hidden');
        } else {
            indicator.classList.add('hidden');
        }
    });
}

$('backBtn').addEventListener('click', () => {
    $('conversation').classList.remove('active-mobile');
    currentChatId = null;
});

function renderMessages(changes) {
    const area = $('messagesArea');
    changes.forEach(change => {
        const msg = change.doc;
        
        if (change.type === 'added') {
            const isOwn = msg.senderId === currentUser.uid;
            const div = document.createElement('div');
            div.className = `message ${isOwn ? 'own' : ''}`;
            div.id = `msg-${msg.id}`;
            
            let content = '';
            if (msg.deleted) {
                content = `<span class="msg-edited"><i class="fa-solid fa-ban"></i> Message supprimé</span>`;
            } else {
                if (msg.imageUrl) {
                    content = `<img src="${msg.imageUrl}" style="max-width:200px; border-radius:8px;">`;
                } else {
                    content = `<span>${msg.text}</span>`;
                }
                
                if (msg.edited) {
                    content += `<div class="msg-edited">(Modifié)</div>`;
                }
            }
            
            div.innerHTML = `
                <div class="message-bubble">
                    ${!isOwn && currentChatType === 'group' ? `<small style="color:${'#1EA7FF'}; font-weight:bold;">${msg.senderName}</small><br>` : ''}
                    ${content}
                    <div class="msg-status">
                        ${new Date(msg.timestamp?.toDate() || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                </div>
            `;
            
            // Add double click to edit, long press to delete
            if (isOwn && !msg.deleted) {
                div.addEventListener('dblclick', () => {
                    const newText = prompt("Modifier le message:", msg.text);
                    if (newText) editMessage(currentChatId, msg.id, newText);
                });
                
                div.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if(confirm("Supprimer ce message?")) {
                        deleteMessage(currentChatId, msg.id);
                    }
                });
            }
            
            area.appendChild(div);
            
            // Play sound if not own and recently added realistically
            if (!isOwn) {
                $('receiveSound').play().catch(()=>{});
                // Send push notification if background
                if (document.hidden && Notification.permission === 'granted') {
                    new Notification(msg.senderName, { body: msg.imageUrl ? 'Image' : msg.text });
                }
            }
            
        } else if (change.type === 'modified') {
            // Very simplified update logic for editing/deleting
            const existing = document.getElementById(`msg-${msg.id}`);
            if (existing) {
                const bubble = existing.querySelector('.message-bubble');
                if (msg.deleted) {
                    bubble.innerHTML = `<span class="msg-edited"><i class="fa-solid fa-ban"></i> Message supprimé</span>`;
                } else {
                    let content = msg.imageUrl ? `<img src="${msg.imageUrl}" style="max-width:200px; border-radius:8px;">` : `<span>${msg.text}</span>`;
                    if (msg.edited) content += `<div class="msg-edited">(Modifié)</div>`;
                    
                    const timeHTML = `<div class="msg-status">${new Date(msg.timestamp?.toDate() || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>`;
                    
                    bubble.innerHTML = `${msg.senderId !== currentUser.uid && currentChatType === 'group' ? `<small style="color:${'#1EA7FF'}; font-weight:bold;">${msg.senderName}</small><br>` : ''}${content}${timeHTML}`;
                }
            }
        }
    });
    
    area.scrollTop = area.scrollHeight;
}

$('sendBtn').addEventListener('click', () => {
    const txt = $('messageInput').value;
    if (txt.trim() === '' || !currentChatId) return;
    sendMessage(currentChatId, txt);
    $('messageInput').value = '';
});

$('messageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        $('sendBtn').click();
    }
});

// Typing Indicator logic
$('messageInput').addEventListener('input', () => {
    if (!currentChatId) return;
    setTypingStatus(currentChatId, true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        setTypingStatus(currentChatId, false);
    }, 2000);
});

// Image Upload
$('attachBtn').addEventListener('click', () => $('imageInput').click());

$('imageInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentChatId) return;
    try {
        const url = await uploadImage(file);
        await sendMessage(currentChatId, '', null, url);
        showToast("Image envoyée", "success");
    } catch (err) {
        showToast(err.message, "error");
    }
    e.target.value = '';
});

// ---- Call Logic ----
$('videoCallBtn').addEventListener('click', async () => {
    if (!currentChatId) return;
    $('callModal').classList.remove('hidden');
    try {
        await startCall(currentChatId, 'localVideo', 'remoteVideo');
    } catch(e) { showToast("Erreur d'appel", "error"); }
});

$('endCallBtn').addEventListener('click', async () => {
    await leaveCall();
    $('callModal').classList.add('hidden');
});

// ---- Utility ----
function setupColorSwatches() {
    const colors = ['#1EA7FF','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899'];
    const targets = ['emailColors', 'phoneColors', 'googleColors', 'anonColors', 'settingsColors'];
    
    targets.forEach(t => {
        const el = $(t);
        if (!el) return;
        colors.forEach(c => {
            const div = document.createElement('div');
            div.className = 'swatch';
            div.style.background = c;
            div.onclick = () => {
                el.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
                div.classList.add('active');
                el.dataset.selected = c;
            };
            el.appendChild(div);
        });
        if(el.firstChild) {
            el.firstChild.classList.add('active');
            el.dataset.selected = colors[0];
        }
    });
}

function showToast(msg, type="info") {
    const toast = document.createElement('div');
    toast.style.padding = '10px 20px';
    toast.style.background = type === 'error' ? '#EF4444' : '#10B981';
    toast.style.color = '#fff';
    toast.style.borderRadius = '5px';
    toast.innerText = msg;
    $('toastContainer').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function renderSidebarInfo() {
    // Extra init when logged in
}
