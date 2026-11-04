import { Capacitor } from "@capacitor/core";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

export const firebaseConfig = { apiKey: "AIzaSyDbi4vqhN6I7Zz7_-6-ZQSZzd3MnQiYBCE", authDomain: "caresits-812a0.firebaseapp.com", projectId: "caresits-812a0", appId: "1:908064912971:web:88858e5fa8751f66b23fce", storageBucket: "caresits-812a0.firebasestorage.app" };
export const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);

const localHost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const emulatorRequested = import.meta.env.VITE_EMULATOR === "1" || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("emu") === "1");
// Capacitor uses localhost for app assets too. Never enable emulators in a native iOS or Android build.
export const emulatorEnabled = localHost && !Capacitor.isNativePlatform() && emulatorRequested;

export const db: Firestore = getFirestore(app);
if (emulatorEnabled) connectFirestoreEmulator(db, "127.0.0.1", 8080);
