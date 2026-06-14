import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const SUPER_ADMIN_COLLECTIONS = ['admins', 'admin', 'super_admins'] as const;

function isActiveAdminDoc(data: Record<string, unknown> | undefined): boolean {
  if (!data) return true;
  if (data.active === false) return false;
  return true;
}

/** Firestore allowlist — uses existing `admins` docs (no credentials in code). */
export async function checkSuperAdminUid(uid: string): Promise<boolean> {
  const id = String(uid || '').trim();
  if (!id || !db) return false;

  for (const collection of SUPER_ADMIN_COLLECTIONS) {
    try {
      const snap = await getDoc(doc(db, collection, id));
      if (snap.exists() && isActiveAdminDoc(snap.data() as Record<string, unknown>)) {
        return true;
      }
    } catch {
      // try next collection / offline cache
    }
  }
  return false;
}

export function markSuperAdminPanelOpen(): void {
  try {
    sessionStorage.setItem('pve_super_admin_panel_open', '1');
  } catch {
    // ignore
  }
}

export function shouldOpenSuperAdminPanel(): boolean {
  try {
    return sessionStorage.getItem('pve_super_admin_panel_open') === '1';
  } catch {
    return false;
  }
}

export function clearSuperAdminPanelOpen(): void {
  try {
    sessionStorage.removeItem('pve_super_admin_panel_open');
  } catch {
    // ignore
  }
}
