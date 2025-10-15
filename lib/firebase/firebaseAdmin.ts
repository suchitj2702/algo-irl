import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

let adminApp: App;
let adminDb: Firestore;

// Lazy initialization function
function getAdminApp(): App {
  if (!adminApp) {
    if (getApps().length === 0) {
      try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
          // Method 1: Use environment variable
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          adminApp = initializeApp({
            credential: cert(serviceAccount),
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          });
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Firebase Admin initialized with environment variable');
          }
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          // Method 2: Use Google Application Credentials
          adminApp = initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          });
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Firebase Admin initialized with Google Application Credentials');
          }
        } else {
          // Method 3: Try to read service account file from project root
          try {
            const serviceAccountPath = join(process.cwd(), 'service-account-key.json');
            const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
            adminApp = initializeApp({
              credential: cert(serviceAccount),
              projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            });
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ Firebase Admin initialized with service-account-key.json file');
            }
          } catch {
            throw new Error(
              '❌ Firebase Admin SDK requires credentials. Please:\n' +
              '1. Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable, OR\n' +
              '2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable, OR\n' +
              '3. Place service-account-key.json in project root\n' +
              'See SECURITY_SETUP.md for detailed instructions.'
            );
          }
        }
      } catch (error) {
        console.error('❌ Firebase Admin SDK initialization failed:', error);
        throw error;
      }
    } else {
      adminApp = getApps()[0];
    }
  }
  return adminApp;
}

function getAdminDb(): Firestore {
  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());
  }
  return adminDb;
}

export { getAdminApp as adminApp, getAdminDb as adminDb }; 