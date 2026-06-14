import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import {
  FIREBASE_API_KEY,
  FIREBASE_APP_ID,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
} from '@env';

function envOrEmpty(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function initMobileFirebase() {
  if (getApps().length) {
    const app = getApps()[0];
    return { app, auth: getAuth(app), db: getFirestore(app) };
  }

  const firebaseConfig = {
    apiKey: envOrEmpty(FIREBASE_API_KEY),
    authDomain: envOrEmpty(FIREBASE_AUTH_DOMAIN),
    projectId: envOrEmpty(FIREBASE_PROJECT_ID),
    storageBucket: envOrEmpty(FIREBASE_STORAGE_BUCKET),
    messagingSenderId: envOrEmpty(FIREBASE_MESSAGING_SENDER_ID),
    appId: envOrEmpty(FIREBASE_APP_ID),
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    return { app: null, auth: null, db: null };
  }

  const app = initializeApp(firebaseConfig);
  let db;
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache() });
  } catch {
    db = getFirestore(app);
  }
  return { app, auth: getAuth(app), db };
}

export const { auth, db } = initMobileFirebase();
