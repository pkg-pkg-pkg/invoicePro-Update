import { doc, getDoc } from 'firebase/firestore';

import { db } from '../firebase/firebase';

export type AppReleaseInfo = {
  latestVersion: string;
  minSupportedVersion?: string | null;
  downloadUrl: string;
  releaseNotes: string;
  mandatory: boolean;
};

function parseSemver(s: string): number[] {
  const m = String(s ?? '')
    .trim()
    .match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return [0, 0, 0];
  return [Number(m[1]) || 0, Number(m[2]) || 0, Number(m[3]) || 0];
}

/** True if a is older than b (semver-like numeric compare). */
export function isOlderVersion(current: string, latest: string): boolean {
  const a = parseSemver(current);
  const b = parseSemver(latest);
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}

export function getBundledAppVersion(): string {
  const v = (import.meta as any).env?.VITE_APP_VERSION;
  return typeof v === 'string' && v.trim() ? v.trim() : '1.0.0';
}

/** Reads public release doc; works without auth. */
export async function fetchAppRelease(): Promise<AppReleaseInfo | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'app_config', 'public'));
    if (!snap.exists()) return null;
    const d = snap.data() as Record<string, unknown>;
    const latestVersion = String(d.latestVersion ?? '').trim();
    const downloadUrl = String(d.downloadUrl ?? '').trim();
    if (!latestVersion || !downloadUrl) return null;
    return {
      latestVersion,
      minSupportedVersion: d.minSupportedVersion != null ? String(d.minSupportedVersion) : null,
      downloadUrl,
      releaseNotes: String(d.releaseNotes ?? ''),
      mandatory: Boolean(d.mandatory),
    };
  } catch {
    return null;
  }
}

export async function checkForAppUpdate(): Promise<{
  updateAvailable: boolean;
  info: AppReleaseInfo | null;
  currentVersion: string;
  belowMinimum: boolean;
}> {
  const currentVersion = getBundledAppVersion();
  const info = await fetchAppRelease();
  if (!info) {
    return { updateAvailable: false, info: null, currentVersion, belowMinimum: false };
  }
  const updateAvailable = isOlderVersion(currentVersion, info.latestVersion);
  const min = info.minSupportedVersion?.trim();
  const belowMinimum = Boolean(min && isOlderVersion(currentVersion, min));
  return { updateAvailable, info, currentVersion, belowMinimum };
}
