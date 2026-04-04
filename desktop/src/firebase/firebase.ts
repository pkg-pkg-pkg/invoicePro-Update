import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// IMPORTANT:
// Previously this helper threw when env vars were missing, which prevented
// Firebase from initialising and left `auth` as null. That in turn caused
// reCAPTCHA / phone auth to fail with "auth not ready". We now log a warning
// but return an empty string so Firebase can still create an app instance.
function requireEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (typeof v !== 'string' || !v.trim()) {
    // eslint-disable-next-line no-console
    console.error(`Missing env var ${name}. Add it to desktop/.env.local`);
    return '';
  }
  return v.trim();
}

export function initFirebase() {
  if (getApps().length) {
    const app = getApps()[0];
    return { app, auth: getAuth(app), db: getFirestore(app), functions: getFunctions(app, 'us-central1') };
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
  return { app, auth: getAuth(app), db: getFirestore(app), functions: getFunctions(app, 'us-central1') };
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
