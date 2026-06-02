import { doc, getDoc } from 'firebase/firestore';

import { db } from '../firebase/firebase';
import { fetchLatestGitHubRelease } from './githubReleaseService';

export type AppReleaseConfig = {
  latestVersion: string;
  downloadUrl: string;
  releaseNotes: string;
};

const CONFIG_DOC = doc(db, 'app_config', 'public');

export async function readAppReleaseConfig(): Promise<AppReleaseConfig | null> {
  const snap = await getDoc(CONFIG_DOC);
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  const latestVersion = String(d.latestVersion ?? '').trim();
  const downloadUrl = String(d.downloadUrl ?? '').trim();
  if (!latestVersion) return null;
  return {
    latestVersion,
    downloadUrl,
    releaseNotes: String(d.releaseNotes ?? ''),
  };
}

/** Firestore config first; falls back to GitHub latest release. */
export async function resolveLatestAppRelease(): Promise<AppReleaseConfig> {
  try {
    const fromConfig = await readAppReleaseConfig();
    if (fromConfig?.latestVersion) return fromConfig;
  } catch {
    // fall through to GitHub
  }

  const gh = await fetchLatestGitHubRelease();
  return {
    latestVersion: gh.version,
    downloadUrl: gh.downloadUrl,
    releaseNotes: gh.releaseNotes,
  };
}
