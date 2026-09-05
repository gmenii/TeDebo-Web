import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyCR6AQ0easiaW3TFS_ACM_YsaqY5bAVbaA",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "tedeboapp.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "tedeboapp",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "tedeboapp.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "429405707056",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:429405707056:android:943a8eb5acb23902a386f5",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
