import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// IMPORTANT: Production builds require all Firebase env vars (validated in vite.config.ts).
function requireEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (typeof v !== 'string' || !v.trim()) {
    const message = `Missing env var ${name}. Add it to desktop/.env.local`;
    if (import.meta.env.PROD) {
      throw new Error(message);
    }
    // eslint-disable-next-line no-console
    console.error(message);
    return '';
  }
  return v.trim();
}

export function getFirebaseApiKey(): string {
  return requireEnv('VITE_FIREBASE_API_KEY');
}

export function initFirebase() {
  if (getApps().length) {
    const existingApp = getApps()[0];
    return {
      app: existingApp,
      auth: getAuth(existingApp),
      db: getFirestore(existingApp),
      functions: getFunctions(existingApp, 'us-central1'),
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
  let firestore;
  try {
    firestore = initializeFirestore(app, { localCache: persistentLocalCache() });
  } catch {
    firestore = getFirestore(app);
  }
  return { app, auth: getAuth(app), db: firestore, functions: getFunctions(app, 'us-central1') };
}

export const { app, auth, db, functions } = (() => {
  try {
    return initFirebase();
  } catch (e) {
    // Allow app boot in dev even if env is missing; screens will show error.
    // eslint-disable-next-line no-console
    console.error(e);
    const app = getApps()[0];
    return {
      app,
      auth: app ? getAuth(app) : (null as any),
      db: app ? getFirestore(app) : (null as any),
      functions: app ? getFunctions(app, 'us-central1') : (null as any),
    };
  }
})();
