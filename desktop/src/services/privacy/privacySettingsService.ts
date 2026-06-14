import {
  DEFAULT_PRIVACY_SETTINGS,
  type PrivacySettings,
} from '../../types/privacyDiagnostics';

const STORAGE_KEY = 'pve_privacy_settings_v1';

export function getPrivacySettings(): PrivacySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRIVACY_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<PrivacySettings>;
    return {
      sendAnonymousDiagnostics: Boolean(parsed.sendAnonymousDiagnostics),
      participateInProductImprovement: Boolean(parsed.participateInProductImprovement),
      sendCrashReports: Boolean(parsed.sendCrashReports),
    };
  } catch {
    return { ...DEFAULT_PRIVACY_SETTINGS };
  }
}

export function savePrivacySettings(next: PrivacySettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('privacySettingsChanged'));
}

export function subscribePrivacySettings(onChange: () => void): () => void {
  const handler = () => onChange();
  window.addEventListener('privacySettingsChanged', handler);
  return () => window.removeEventListener('privacySettingsChanged', handler);
}
