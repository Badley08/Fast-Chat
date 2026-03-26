import { db } from './firebaseConfig.js';
import { currentUser } from './AuthService.js';
import { 
    collection, query, where, orderBy, onSnapshot, 
    addDoc, doc, updateDoc, setDoc, getDoc, serverTimestamp, getDocs
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

let chatsUnsubscribe = null;
let messagesUnsubscribe = null;

export const loadChats = (onChatsUpdate) => {
    if (!currentUser) return;
    if (chatsUnsubscribe) chatsUnsubscribe();

    const q = query(
        collection(db, 'chats'),
        where('members', 'array-contains', currentUser.uid),
        orderBy('lastMessageTime', 'desc')
    );

    chatsUnsubscribe = onSnapshot(q, async (snap) => {
        const chats = [];
        for (const docSnap of snap.docs) {
            chats.push({ id: docSnap.id, ...docSnap.data() });
        }
        
        // Load recent_chats pinned subcollection
        const recentSnap = await getDocs(collection(db, 'users', currentUser.uid, 'recent_chats'));
        const recentPins = recentSnap.docs.map(d => d.id);
        
        onChatsUpdate(chats, recentPins);
    });
};

export const loadMessages = (chatId, onMessagesUpdate) => {
    if (!currentUser) return;
    if (messagesUnsubscribe) messagesUnsubscribe();

    const q = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('timestamp', 'asc')
    );

    messagesUnsubscribe = onSnapshot(q, (snap) => {
        const changes = snap.docChanges().map(change => ({
            type: change.type, 
            doc: { id: change.doc.id, ...change.doc.data() }
        }));
        onMessagesUpdate(changes);
    });
};

export const sendMessage = async (chatId, text, replyToMessage = null, imageUrl = null) => {
    if (!currentUser) return;

    const payload = {
        text,
        senderId: currentUser.uid,
        senderName: currentUser.username,
        timestamp: serverTimestamp(),
        deleted: false,
        edited: false,
        readBy: [currentUser.uid]
    };

    if (replyToMessage) {
        payload.replyTo = { 
            id: replyToMessage.id, 
            senderName: replyToMessage.senderName, 
            text: replyToMessage.text 
        };
    }
    
    if (imageUrl) {
        payload.imageUrl = imageUrl;
    }

    const msgRef = await addDoc(collection(db, 'chats', chatId, 'messages'), payload);
    
    // Update chat metadata
    await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: imageUrl ? 'Image' : text,
        lastMessageTime: serverTimestamp()
    });
    
    // Pin to recent_chats natively for local user
    await setDoc(doc(db, 'users', currentUser.uid, 'recent_chats', chatId), {
        pinnedAt: serverTimestamp()
    });

    // Clear typing status
    setTypingStatus(chatId, false);
    
    return msgRef;
};

export const editMessage = async (chatId, messageId, newText) => {
    if (!currentUser) return;
    await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
        text: newText,
        edited: true
    });
    
    // Also update the chat's last message if this was the latest one
    // (A bit complex efficiently, but let's just update if necessary)
};

export const deleteMessage = async (chatId, messageId) => {
    if (!currentUser) return;
    await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
        deleted: true,
        text: ''
    });
};

export const createGroup = async (groupName, memberIds) => {
    if (!currentUser) return;
    const allMembers = [currentUser.uid, ...memberIds];
    const newChatRef = await addDoc(collection(db, 'chats'), {
        isGroup: true,
        name: groupName,
        members: allMembers,
        admin: currentUser.uid,
        createdAt: serverTimestamp(),
        lastMessage: 'Groupe créé',
        lastMessageTime: serverTimestamp()
    });
    return newChatRef.id;
};

// Search users
export const searchUsers = async (searchTerm) => {
    // Firestore doesn't support native fuzzy search easily, so we usually download all or use an index.
    // Assuming small userbase, just a basic filter:
    const q = query(collection(db, 'users'));
    const snap = await getDocs(q);
    const term = searchTerm.toLowerCase();
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.username.toLowerCase().includes(term) && u.id !== currentUser?.uid);
};

export const joinGroupByName = async (groupName) => {
    if (!currentUser) return null;
    const q = query(
        collection(db, 'chats'),
        where('isGroup', '==', true),
        where('name', '==', groupName)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
        const groupDoc = snap.docs[0];
        const groupData = groupDoc.data();
        if (!groupData.members.includes(currentUser.uid)) {
            // Join group natively (array union)
            const { arrayUnion } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
            await updateDoc(doc(db, 'chats', groupDoc.id), {
                members: arrayUnion(currentUser.uid)
            });
        }
        return { id: groupDoc.id, ...groupData };
    }
    return null;
};

// Typing indicator functionality
export const setTypingStatus = async (chatId, isTyping) => {
    if (!currentUser) return;
    try {
        await updateDoc(doc(db, 'chats', chatId), {
            [`typing.${currentUser.uid}`]: isTyping ? currentUser.username : null
        });
    } catch(err) {
        console.error("Set typing error:", err);
    }
};

export const listenToTyping = (chatId, onTypingUpdate) => {
    return onSnapshot(doc(db, 'chats', chatId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const typingUsers = Object.entries(data.typing || {})
                 .filter(([uid, name]) => name !== null && uid !== currentUser.uid)
                 .map(([uid, name]) => name);
            onTypingUpdate(typingUsers);
        }
    });
};
