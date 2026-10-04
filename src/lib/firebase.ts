import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut as fbSignOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCkAjdxP3O3vMYCH0_h2s0tIzLvnYqHgNU",
  authDomain: "nairatax-6128f.firebaseapp.com",
  projectId: "nairatax-6128f",
  storageBucket: "nairatax-6128f.firebasestorage.app",
  messagingSenderId: "191926361557",
  appId: "1:191926361557:web:67c85cae5a0e4d9c5db15c",
  measurementId: "G-7YN5K8Q5VW"
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export { signInWithCustomToken, fbSignOut, onAuthStateChanged };
export type { User };
