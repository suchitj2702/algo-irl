import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// NOTE: This file is for CLIENT-SIDE Firebase SDK usage only
// For server-side operations, use lib/firebase/firebaseAdmin.ts
// 
// Client-side usage:
// - Authentication (sign in, sign up, sign out)
// - Real-time listeners (if needed)
// 
// Server-side usage (Admin SDK):
// - All database operations (CRUD)
// - Server-side authentication verification
// - Firestore operations in API routes

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase for client-side usage (authentication only)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// NOTE: We no longer export 'db' from here as all database operations
// should use the Admin SDK from firebaseAdmin.ts
export { app, auth };