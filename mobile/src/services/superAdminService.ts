import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const COLLECTIONS = ['admins', 'admin', 'super_admins'] as const;

export async function checkSuperAdminUid(uid: string): Promise<boolean> {
  const id = String(uid || '').trim();
  if (!id || !db) return false;
  for (const collection of COLLECTIONS) {
    try {
      const snap = await getDoc(doc(db, collection, id));
      if (snap.exists()) {
        const active = snap.data()?.active;
        if (active === false) continue;
        return true;
      }
    } catch {
      // offline / rules
    }
  }
  return false;
}
