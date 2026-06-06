import { doc, getDoc, onSnapshot } from 'firebase/firestore';

import { db } from '../firebase/firebase';

const CACHE_PREFIX = 'pve_user_display_name_v1_';

export function resolveDisplayNameFromProfile(
  data: Record<string, unknown> | null | undefined
): string {
  if (!data) return '';
  const fullName = String(data.fullName ?? '').trim();
  const electricianName = String(data.electricianName ?? '').trim();
  const name = String(data.name ?? '').trim();
  if (fullName) return fullName;
  if (electricianName) return electricianName;
  if (name) return name;
  return '';
}

function cacheKey(email: string): string {
  return `${CACHE_PREFIX}${email.trim().toLowerCase()}`;
}

export function readCachedDisplayName(email: string): string {
  try {
    return String(localStorage.getItem(cacheKey(email)) ?? '').trim();
  } catch {
    return '';
  }
}

function writeCachedDisplayName(email: string, name: string): void {
  try {
    if (name) localStorage.setItem(cacheKey(email), name);
  } catch {
    // ignore
  }
}

/** True when name is likely an email local-part, not a real profile name. */
export function isLikelyEmailUsername(name: string, email: string): boolean {
  const n = String(name ?? '').trim().toLowerCase();
  const e = String(email ?? '').trim().toLowerCase();
  if (!n || !e) return false;
  const local = e.split('@')[0] || '';
  return n === local || n === e;
}

export function pickBestDisplayName(
  candidates: Array<string | null | undefined>,
  email: string,
  fallback = 'User'
): string {
  for (const c of candidates) {
    const v = String(c ?? '').trim();
    if (!v) continue;
    if (isLikelyEmailUsername(v, email)) continue;
    return v;
  }
  const cached = email ? readCachedDisplayName(email) : '';
  if (cached) return cached;
  return fallback;
}

async function readUserProfileDoc(uid: string, email: string): Promise<Record<string, unknown> | null> {
  if (!db) return null;
  const emailId = email.trim().toLowerCase();
  const ids = [...new Set([emailId, uid].filter(Boolean))];
  for (const id of ids) {
    try {
      const snap = await getDoc(doc(db, 'users', id));
      if (snap.exists()) return snap.data() as Record<string, unknown>;
    } catch {
      // try next id
    }
  }
  return null;
}

export async function fetchUserDisplayName(
  uid: string,
  email: string,
  fallback = 'User'
): Promise<string> {
  const cached = readCachedDisplayName(email);
  const data = await readUserProfileDoc(uid, email);
  const fromDoc = resolveDisplayNameFromProfile(data);
  const name = pickBestDisplayName([fromDoc, cached], email, fallback);
  if (name && name !== 'User') writeCachedDisplayName(email, name);
  return name;
}

export function subscribeUserDisplayName(
  uid: string,
  email: string,
  onName: (name: string) => void
): () => void {
  if (!db || !email.trim()) return () => undefined;

  const emailId = email.trim().toLowerCase();
  const cached = readCachedDisplayName(emailId);
  if (cached) onName(cached);

  let latest = cached;
  const apply = (data: Record<string, unknown> | undefined) => {
    const name = resolveDisplayNameFromProfile(data);
    if (!name || name === latest) return;
    latest = name;
    writeCachedDisplayName(emailId, name);
    onName(name);
    window.dispatchEvent(
      new CustomEvent('pve-user-display-name', { detail: { email: emailId, name } })
    );
  };

  const unsubs: Array<() => void> = [];
  unsubs.push(
    onSnapshot(
      doc(db, 'users', emailId),
      (snap) => apply(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined),
      () => undefined
    )
  );

  if (uid && uid !== emailId) {
    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => apply(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined),
        () => undefined
      )
    );
  }

  return () => unsubs.forEach((u) => u());
}
