import {
  doc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { auth, db } from '../firebase/firebase';
import { getBundledAppVersion } from './appUpdateService';
import { getNormalizedCompanyProfile } from '../utils/companyProfile';

const SESSION_STORAGE_KEY = 'pve_usage_session_v1';
const LAST_HEARTBEAT_DATE_KEY = 'last_heartbeat_date';

interface SessionState {
  sessionId: string;
  startedAt: number;
  lastFlushedAt: number;
}

let trackingStarted = false;
let unloadBound = false;

function normalizeEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

function getStoredUserEmail(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: unknown; username?: unknown };
    const email = String(parsed.email ?? parsed.username ?? '').trim();
    return email ? email : null;
  } catch {
    return null;
  }
}

function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

function readSession(): SessionState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

function writeSession(session: SessionState): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function getUsageContext() {
  if (!auth?.currentUser || !db || !isOnline()) return null;
  const email = normalizeEmail(String(auth.currentUser.email ?? ''));
  if (!email) return null;
  const company = getNormalizedCompanyProfile();
  const companyName = String(company.businessName || company.name || '').trim();
  return {
    email,
    userRef: doc(db, 'users', email),
    companyName,
    appVersion: getBundledAppVersion(),
    platform: typeof window !== 'undefined' && (window as { electronAPI?: unknown }).electronAPI
      ? 'desktop'
      : 'web',
  };
}

async function writeSessionLog(
  ctx: NonNullable<ReturnType<typeof getUsageContext>>,
  session: SessionState,
  fields: Record<string, unknown>
): Promise<void> {
  const sessionRef = doc(db!, 'users', ctx.email, 'usage_sessions', session.sessionId);
  await setDoc(
    sessionRef,
    {
      startedAt: new Date(session.startedAt),
      appVersion: ctx.appVersion,
      companyName: ctx.companyName,
      platform: ctx.platform,
      updatedAt: serverTimestamp(),
      ...fields,
    },
    { merge: true }
  );
}

async function flushElapsedMinutes(
  ctx: NonNullable<ReturnType<typeof getUsageContext>>,
  session: SessionState,
  opts?: { finalize?: boolean; endReason?: string }
): Promise<void> {
  const now = Date.now();
  const deltaMin = Math.floor((now - session.lastFlushedAt) / 60000);
  const totalSessionMin = Math.max(1, Math.round((now - session.startedAt) / 60000));

  const userPatch: Record<string, unknown> = {
    appVersion: ctx.appVersion,
    companyName: ctx.companyName,
    businessName: ctx.companyName,
    liveSessionMinutes: opts?.finalize ? 0 : totalSessionMin,
    usagePlatform: ctx.platform,
  };

  if (deltaMin >= 1) {
    userPatch.totalUsageMinutes = increment(deltaMin);
  }

  if (opts?.finalize) {
    userPatch.lastSessionDurationMinutes = totalSessionMin;
    userPatch.lastSessionEndedAt = serverTimestamp();
  }

  await updateDoc(ctx.userRef, userPatch);

  session.lastFlushedAt = now;
  writeSession(session);

  await writeSessionLog(ctx, session, {
    durationMinutes: totalSessionMin,
    status: opts?.finalize ? 'ended' : 'active',
    ...(opts?.finalize ? { endedAt: serverTimestamp(), endReason: opts.endReason || 'close' } : {}),
  });
}

/** Write lastLogin at most once per calendar day (no periodic heartbeat). */
export async function recordDailyLoginIfDue(): Promise<void> {
  const ctx = getUsageContext();
  if (!ctx) return;

  const today = new Date().toDateString();
  const lastBeat = localStorage.getItem(LAST_HEARTBEAT_DATE_KEY);
  if (lastBeat === today) return;

  try {
    await updateDoc(ctx.userRef, {
      lastLogin: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
      appVersion: ctx.appVersion,
    });
    localStorage.setItem(LAST_HEARTBEAT_DATE_KEY, today);
  } catch {
    // offline or rules
  }
}

async function beginNewSession(
  ctx: NonNullable<ReturnType<typeof getUsageContext>>
): Promise<void> {
  const now = Date.now();
  const session: SessionState = {
    sessionId: `${now}_${Math.random().toString(36).slice(2, 10)}`,
    startedAt: now,
    lastFlushedAt: now,
  };
  writeSession(session);

  await setDoc(
    ctx.userRef,
    {
      lastAppOpenAt: serverTimestamp(),
      appVersion: ctx.appVersion,
      companyName: ctx.companyName,
      businessName: ctx.companyName,
      usagePlatform: ctx.platform,
      liveSessionMinutes: 0,
      sessionCount: increment(1),
    },
    { merge: true }
  );

  await writeSessionLog(ctx, session, {
    durationMinutes: 0,
    status: 'active',
    endedAt: null,
  });
}

function bindUnloadHandlers(): void {
  if (unloadBound || typeof window === 'undefined') return;
  unloadBound = true;

  const finalize = () => {
    const ctx = getUsageContext();
    const session = readSession();
    if (!ctx || !session) return;
    void flushElapsedMinutes(ctx, session, { finalize: true, endReason: 'close' })
      .catch(() => undefined)
      .finally(() => clearSession());
  };

  window.addEventListener('pagehide', finalize);
  window.addEventListener('beforeunload', finalize);
}

/** Start session tracking: daily login ping + usage minutes on close (no interval heartbeat). */
export async function startUsageTracking(): Promise<void> {
  if (trackingStarted) return;
  const ctx = getUsageContext();
  if (!ctx) return;

  trackingStarted = true;
  bindUnloadHandlers();

  let session = readSession();
  try {
    if (!session) {
      await beginNewSession(ctx);
    }
    await recordDailyLoginIfDue();
  } catch {
    // ignore
  }
}

/** Backward-compatible entry (replaces old 6-hour throttle ping). */
export async function recordUserActivityIfDue(): Promise<void> {
  await startUsageTracking();
}

export function stopUsageTracking(): void {
  trackingStarted = false;
}

/** @deprecated No periodic heartbeat — use recordDailyLoginIfDue. */
export async function recordHeartbeat(): Promise<void> {
  await recordDailyLoginIfDue();
}
