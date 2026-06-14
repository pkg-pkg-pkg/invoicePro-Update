import { getBundledReleaseNotes } from '../constants/bundledReleaseNotes';
import { isElectronRuntime } from '../utils/runtime';

export const LAST_SEEN_RELEASE_NOTES_VERSION_KEY = 'last_seen_version';
const LEGACY_LAST_SEEN_RELEASE_NOTES_VERSION_KEY = 'lastSeenReleaseNotesVersion';

export function normalizeAppVersion(version: string): string {
  return String(version ?? '').trim().replace(/^v/i, '');
}

async function readFromKvStore(key: string): Promise<string | null> {
  try {
    if (isElectronRuntime() && window.electronAPI?.storageRead) {
      const fromStore = await window.electronAPI.storageRead<string>(key);
      if (fromStore) return normalizeAppVersion(String(fromStore));
    }
  } catch {
    // fall through to localStorage
  }

  try {
    const fromLocal = localStorage.getItem(key);
    return fromLocal ? normalizeAppVersion(fromLocal) : null;
  } catch {
    return null;
  }
}

async function readStoredVersion(): Promise<string | null> {
  const current = await readFromKvStore(LAST_SEEN_RELEASE_NOTES_VERSION_KEY);
  if (current) return current;

  const legacy = await readFromKvStore(LEGACY_LAST_SEEN_RELEASE_NOTES_VERSION_KEY);
  if (legacy) {
    await acknowledgeReleaseNotesVersion(legacy);
    return legacy;
  }

  return null;
}

export async function getLastSeenReleaseNotesVersion(): Promise<string | null> {
  return readStoredVersion();
}

export async function acknowledgeReleaseNotesVersion(version: string): Promise<void> {
  const normalized = normalizeAppVersion(version);
  if (!normalized) return;

  try {
    localStorage.setItem(LAST_SEEN_RELEASE_NOTES_VERSION_KEY, normalized);
  } catch {
    // ignore
  }

  try {
    if (isElectronRuntime() && window.electronAPI?.storageWrite) {
      await window.electronAPI.storageWrite(LAST_SEEN_RELEASE_NOTES_VERSION_KEY, normalized);
    }
  } catch {
    // ignore
  }
}

/** True when bundled notes exist for this version and user has not acknowledged it yet. */
export async function shouldShowReleaseNotesForVersion(currentVersion: string): Promise<boolean> {
  const normalized = normalizeAppVersion(currentVersion);
  if (!normalized) return false;
  if (!getBundledReleaseNotes(normalized)) return false;

  const lastSeen = await getLastSeenReleaseNotesVersion();
  return normalized !== lastSeen;
}

const RELEASE_NOTES_ACK_MIGRATION_KEY = 'releaseNotesAckV1Migrated';

/**
 * One-time: users who already ran v3.5.6 before ack tracking existed are not prompted again.
 */
export async function migrateReleaseNotesAckIfNeeded(currentVersion: string): Promise<void> {
  try {
    if (localStorage.getItem(RELEASE_NOTES_ACK_MIGRATION_KEY) === '1') return;
    const lastSeen = await getLastSeenReleaseNotesVersion();
    if (lastSeen) {
      localStorage.setItem(RELEASE_NOTES_ACK_MIGRATION_KEY, '1');
      return;
    }
    const normalized = normalizeAppVersion(currentVersion);
    const hasUsedApp = Boolean(localStorage.getItem('lastUpdateCheck'));
    if (hasUsedApp && normalized) {
      await acknowledgeReleaseNotesVersion(normalized);
    }
    localStorage.setItem(RELEASE_NOTES_ACK_MIGRATION_KEY, '1');
  } catch {
    // ignore
  }
}
