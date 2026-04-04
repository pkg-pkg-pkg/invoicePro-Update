import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const USERS_COLLECTION = 'users';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Sync plain-text password to Firestore user profile.
 * This is used so passwords typed on any device are backed up centrally
 * and can be restored/synced to other devices.
 *
 * NOTE: This is NOT a replacement for Firebase Auth; it is an app-level
 * backup. Firestore rules must protect this field appropriately.
 */
export async function syncPasswordToFirestore(
  email: string,
  password: string,
  extra?: Record<string, any>,
): Promise<void> {
  try {
    if (!db) return;
    const normalizedEmail = normalizeEmail(email);
    const userRef = doc(db, USERS_COLLECTION, normalizedEmail);

    const payload: any = {
      password,
      passwordLastUpdated: serverTimestamp(),
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

