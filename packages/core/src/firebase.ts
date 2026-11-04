import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
export const firebaseConfig = { apiKey: "AIzaSyDbi4vqhN6I7Zz7_-6-ZQSZzd3MnQiYBCE", authDomain: "caresits-812a0.firebaseapp.com", projectId: "caresits-812a0", appId: "1:908064912971:web:88858e5fa8751f66b23fce", storageBucket: "caresits-812a0.firebasestorage.app" };
export const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
export const db: Firestore = getFirestore(app);
