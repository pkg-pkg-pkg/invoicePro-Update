import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const USERS_COLLECTION = 'users';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Sync non-sensitive security metadata to Firestore user profile.
 *
 * IMPORTANT:
 * Passwords must never be stored in Firestore (plain-text or encrypted).
 * Authentication password state is managed by Firebase Auth / backend only.
 */
export async function syncPasswordToFirestore(
  email: string,
  _password: string,
  extra?: Record<string, any>,
): Promise<void> {
  try {
    if (!db) return;
    const normalizedEmail = normalizeEmail(email);
    const userRef = doc(db, USERS_COLLECTION, normalizedEmail);

    const payload: any = {
      credentialsUpdatedAt: serverTimestamp(),
    };

    if (extra) {
      Object.assign(payload, extra);
    }

    await setDoc(userRef, payload, { merge: true });
  } catch (err) {
    // Do not block login/activation if sync fails; just log for debugging.
    console.warn('Password sync to Firestore failed:', err);
  }
}

