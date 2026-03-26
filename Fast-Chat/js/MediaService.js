import { db } from './firebaseConfig.js';
import { currentUser } from './AuthService.js';
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dqqj3xlul/image/upload';
const UPLOAD_PRESET = 'fastchat_preset'; // Must be created in Cloudinary (unsigned)
const MAX_IMAGES_PER_DAY = 5;

// Compress image via Canvas
const compressImage = (file, maxWidth = 1000, quality = 0.8) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                }, 'image/jpeg', quality);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
};

const checkDailyLimit = async () => {
    if (!currentUser) throw new Error('Not authenticated');
    
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const statsRef = doc(db, 'users', currentUser.uid, 'stats', 'media');
    
    const statsSnap = await getDoc(statsRef);
    if (statsSnap.exists()) {
        const data = statsSnap.data();
        if (data.date === today) {
            if (data.count >= MAX_IMAGES_PER_DAY) {
                throw new Error('Vous avez atteint la limite de 5 images par jour.');
            }
            return data.count + 1;
        }
    }
    // New day or first time
    return 1;
};

const incrementDailyLimit = async (newCount) => {
    const today = new Date().toISOString().slice(0, 10);
    const statsRef = doc(db, 'users', currentUser.uid, 'stats', 'media');
    
    await setDoc(statsRef, {
        date: today,
        count: newCount
    }, { merge: true });
};

export const uploadImage = async (file) => {
    try {
        // 1. Check limit
        const newCount = await checkDailyLimit();
        
        // 2. Compress image
        const compressedFile = await compressImage(file);
        
        // 3. Upload to Cloudinary
        const formData = new FormData();
        formData.append('file', compressedFile);
        formData.append('upload_preset', UPLOAD_PRESET);
        
        const response = await fetch(CLOUDINARY_URL, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Échec de l\'envoi vers Cloudinary. (Vérifiez votre Upload Preset)');
        }
        
        const data = await response.json();
        
        // 4. Increment daily limit upon success
        await incrementDailyLimit(newCount);
        
        return data.secure_url;
    } catch (error) {
        console.error("Upload error:", error);
        throw error;
    }
};
