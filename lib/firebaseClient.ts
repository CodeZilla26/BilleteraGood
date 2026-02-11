import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

let firebaseApp: FirebaseApp;

const firebaseConfig = {
  apiKey: "AIzaSyArupUba23UsfNXcVYYBvtL0eKxpNWmD8Q",
  authDomain: "fireapp-82c88.firebaseapp.com",
  databaseURL: "https://fireapp-82c88-default-rtdb.firebaseio.com",
  projectId: "fireapp-82c88",
  storageBucket: "fireapp-82c88.firebasestorage.app",
  messagingSenderId: "69604234606",
  appId: "1:69604234606:web:871d2ccf0942ed8c431d7f",
  measurementId: "G-5FGDRX59BR",
};

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    firebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  return firebaseApp;
}

export const firebaseAuth = getAuth(getFirebaseApp());
export const firebaseDb = getDatabase(getFirebaseApp());

export async function initFirebaseAnalytics(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { getAnalytics } = await import("firebase/analytics");
    getAnalytics(getFirebaseApp());
  } catch {
    return;
  }
}
