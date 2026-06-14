import * as admin from 'firebase-admin';

let initialized = false;

/** Lazy Firebase Admin init — must not run at module load time. */
export function ensureAdminInitialized(): void {
  if (initialized) return;
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  admin.firestore().settings({ ignoreUndefinedProperties: true });
  initialized = true;
}

export { admin };
