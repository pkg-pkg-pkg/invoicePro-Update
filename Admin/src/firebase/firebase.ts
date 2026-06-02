import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';

function requireEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (typeof v !== 'string' || !v.trim()) return '';
  return v.trim();
}

export function initFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore; functions: Functions } {
  if (getApps().length) {
    const app = getApps()[0]!;
    return {
      app,
      auth: getAuth(app),
      db: getFirestore(app),
      functions: getFunctions(app, 'us-central1'),
    };
  }

  const firebaseConfig = {
    apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
    authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: requireEnv('VITE_FIREBASE_APP_ID'),
  };

  const app = initializeApp(firebaseConfig);
  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    functions: getFunctions(app, 'us-central1'),
  };
}

export const { auth, db, functions } = initFirebase();

