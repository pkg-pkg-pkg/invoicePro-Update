import { auth, db } from '../firebase/firebase';
import { APP_VERSION } from '../constants/appBranding';
import { isElectronRuntime } from '../utils/runtime';
import { syncElectronStore } from './sync/syncElectronStore';
import { getLogs } from './errorLogger';
import { backupService } from './backupService';

export type SuperAdminDiagnosticReport = Record<string, unknown>;

async function pingUrl(url: string): Promise<{ ok: boolean; ms: number }> {
  const base = String(url || '').replace(/\/$/, '');
  if (!base) return { ok: false, ms: 0 };
  const start = Date.now();
  try {
    const res = await fetch(`${base}/health`, { method: 'GET', signal: AbortSignal.timeout(8000) });
    return { ok: res.ok, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  }
}

export async function buildSuperAdminDiagnosticReport(user: {
  id?: string;
  email?: string;
  role?: string;
  fullName?: string;
} | null): Promise<SuperAdminDiagnosticReport> {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  const [runtime, dbStatus, network, syncEnabled, middlewareUrl, jwt, lastSynced, queue] =
    await Promise.all([
      api?.superAdminGetRuntime?.() ?? null,
      api?.superAdminGetDbStatus?.() ?? null,
      api?.superAdminGetNetwork?.() ?? null,
      syncElectronStore.getSyncEnabled(),
      syncElectronStore.getMiddlewareUrl(),
      syncElectronStore.getJwtToken(),
      syncElectronStore.read<string>('lastSyncedAt'),
      syncElectronStore.getDeltaQueue(),
    ]);

  const ipaPing = await pingUrl(middlewareUrl);
  let firebaseReachable = false;
  try {
    firebaseReachable = typeof navigator !== 'undefined' ? navigator.onLine : true;
  } catch {
    firebaseReachable = false;
  }

  const history = backupService.getBackupHistory() as Array<{ date?: string }>;
  const firebaseUser = auth?.currentUser;

  return {
    generatedAt: new Date().toISOString(),
    system: {
      appVersion: APP_VERSION,
      electronVersion: runtime?.electronVersion,
      nodeVersion: runtime?.nodeVersion,
      osVersion: runtime?.osVersion,
      ramMb: runtime?.ramMb,
      uptimeSec: runtime?.uptimeSec,
    },
    database: dbStatus,
    sync: {
      syncEnabled,
      middlewareUrl,
      syncJwtToken: jwt ? 'present' : 'missing',
      lastSyncedAt: lastSynced || null,
      pendingQueue: Array.isArray(queue) ? queue.length : 0,
      ipaOnline: ipaPing.ok,
      ipaLatencyMs: ipaPing.ms,
    },
    firebase: {
      authConnected: Boolean(firebaseUser),
      firestoreConnected: Boolean(db),
      uid: firebaseUser?.uid || user?.id || '',
      projectId: (import.meta as { env?: Record<string, string> }).env?.VITE_FIREBASE_PROJECT_ID || '',
      firebaseReachable,
    },
    network,
    session: {
      user: user?.fullName || user?.email || '',
      role: user?.role || '',
      uid: firebaseUser?.uid || user?.id || '',
      sessionStart: sessionStorage.getItem('pve_session_start') || null,
    },
    backup: {
      lastBackup: history[0]?.date || null,
    },
    logs: getLogs(),
  };
}

export async function fetchIpaSuperAdminDiagnostic(
  middlewareUrl: string,
  firebaseIdToken: string
): Promise<Record<string, unknown> | null> {
  const base = String(middlewareUrl || '').replace(/\/$/, '');
  if (!base || !firebaseIdToken) return null;
  try {
    const res = await fetch(`${base}/api/superadmin/diagnostic`, {
      headers: { Authorization: `Bearer ${firebaseIdToken}` },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return (await res.json()) as Record<string, unknown>;
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isElectronSuperAdminRuntime(): boolean {
  return isElectronRuntime();
}
