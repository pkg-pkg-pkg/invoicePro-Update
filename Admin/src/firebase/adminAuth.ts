import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export type AdminCheck = 'yes' | 'no' | 'rules';

export async function checkAdminUid(uid: string): Promise<AdminCheck> {
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    if (snap.exists()) return 'yes';
    const legacy = await getDoc(doc(db, 'admin', uid));
    return legacy.exists() ? 'yes' : 'no';
  } catch (e: unknown) {
    const code = String((e as { code?: string })?.code ?? '');
    if (code.includes('permission-denied')) return 'rules';
    throw e;
  }
}

export function adminCheckMessage(result: AdminCheck, uid?: string): string {
  if (result === 'yes') return '';
  if (result === 'rules') {
    return 'Missing or insufficient permissions — deploy desktop/firestore.rules (admins read), then refresh.';
  }
  const id = uid ? `admins/${uid}` : 'admins/{your-firebase-uid}';
  return `Not authorized. Create Firestore document ${id} (Firebase Console → Authentication → copy UID).`;
}
