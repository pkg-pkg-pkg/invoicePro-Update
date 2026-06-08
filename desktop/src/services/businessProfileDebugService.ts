import { isElectronRuntime } from '../utils/runtime';
import {
  exportCompanyLocalStorage,
} from '../utils/companyLocalStorage';
import { getDataStorageDiagnostics } from './dataStorageService';
import { getProfileCompletionStatus } from './companyProfileDbService';

export type OnboardingDecision = {
  showBusinessProfile: boolean;
  reason: string;
  userCompletedFlag: boolean;
  profileCompletedLocal: boolean;
  setupCompletedInStorage: boolean;
  companyNameInStorage: boolean;
  localStorageKeyCount: number;
  profileKeysPresent: string[];
};

export function evaluateOnboardingDecision(profileCompletedInDb: boolean): OnboardingDecision {
  const exported = exportCompanyLocalStorage();
  const showBusinessProfile = !profileCompletedInDb;
  const reason = profileCompletedInDb
    ? 'sqlite_profile_completed'
    : 'sqlite_profile_incomplete_or_missing';

  const decision: OnboardingDecision = {
    showBusinessProfile,
    reason,
    userCompletedFlag: profileCompletedInDb,
    profileCompletedLocal: profileCompletedInDb,
    setupCompletedInStorage: profileCompletedInDb,
    companyNameInStorage: profileCompletedInDb,
    localStorageKeyCount: Object.keys(exported).length,
    profileKeysPresent: [],
  };

  console.log('[profile-debug] onboarding_decision', decision);
  void logProfileDebugEvent('onboarding_decision', decision);
  return decision;
}

export async function logProfileDebugEvent(
  event: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  if (!isElectronRuntime() || !window.electronAPI?.profileDebugLog) return;
  try {
    await window.electronAPI.profileDebugLog({ event, ...payload });
  } catch (err) {
    console.warn('[profile-debug] ipc log failed', err);
  }
}

export async function scanProfilePersistenceDebug(): Promise<Record<string, unknown> | null> {
  if (!isElectronRuntime() || !window.electronAPI?.profileDebugScan) return null;
  try {
    const report = await window.electronAPI.profileDebugScan();
    console.log('[profile-debug] scan_report', report);
    return report as Record<string, unknown>;
  } catch (err) {
    console.warn('[profile-debug] scan failed', err);
    return null;
  }
}

export async function runStartupProfileDiagnostics(userEmail?: string): Promise<void> {
  const localSnapshot = exportCompanyLocalStorage();
  const storageDiag = await getDataStorageDiagnostics();
  const profileStatus = isElectronRuntime() ? await getProfileCompletionStatus() : null;
  await logProfileDebugEvent('startup', {
    userEmail: userEmail || '',
    localKeyCount: Object.keys(localSnapshot).length,
    dataLocationType: storageDiag?.dataLocationType,
    databasePath: storageDiag?.databasePath ?? profileStatus?.databasePath,
    dataRoot: storageDiag?.dataRoot,
    profileCompleted: profileStatus?.profileCompleted ?? profileStatus?.PROFILE_COMPLETED,
    profileReason: profileStatus?.reason ?? profileStatus?.REASON,
    migrationStatus: profileStatus?.migrationStatus ?? profileStatus?.MIGRATION_STATUS,
    companyCode: profileStatus?.companyCode ?? profileStatus?.COMPANY_CODE,
    companyName: profileStatus?.companyName ?? profileStatus?.COMPANY_NAME,
    databaseSizeBytes: storageDiag?.databaseSizeBytes,
    readPath: storageDiag?.readPath,
  });
  await scanProfilePersistenceDebug();
}

/** Returns true when SQLite profile is complete (authoritative on Electron). */
export async function isBusinessProfileCompleteOnDisk(): Promise<boolean> {
  if (!isElectronRuntime()) return false;
  const status = await getProfileCompletionStatus();
  return Boolean(status.profileCompleted ?? status.PROFILE_COMPLETED);
}
