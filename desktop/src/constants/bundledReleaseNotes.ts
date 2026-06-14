/** Shown in Settings → About when cloud release notes are empty. Key = semver without v prefix. */
export const BUNDLED_RELEASE_NOTES: Record<string, string> = {
  '3.5.6': [
    'Version 3.5.6 — PVE InvoicePro 360',
    '',
    'LICENSE',
    '• Activate once — permanent local licence cache; cloud validation only for activation, transfer, and manual verify',
    '• Settings → Security: manual licence verify panel',
    '• Daily usage heartbeat (once per day, not every 5 minutes)',
    '',
    'BARCODE & INVENTORY',
    '• USB wedge + camera barcode scan on Sales & Purchase vouchers',
    '• Auto barcode on items; bulk barcode print; low-stock settings & report',
    '',
    'TRIAL (7 DAYS)',
    '• Login: Start 7-Day Free Trial — visible trial credentials (trial@pve360.com)',
    '• OTP trial flow (/trial): Firebase Phone Auth, device fingerprint, location, Firestore trials/',
    '• Trial banner, expiry modal, Admin → Trial Users tab',
    '• Cloud Functions on invoicepro-105ba: createTrial, validateTrial, extendTrial, adminTrialAction',
    '',
    'FIREBASE',
    '• All deploys target project invoicepro-105ba (InvoicePro production)',
    '• Firestore rules for trials/ and trial_settings/',
  ].join('\n'),
};

export function getBundledReleaseNotes(version: string): string | null {
  const key = String(version ?? '').trim().replace(/^v/i, '');
  return BUNDLED_RELEASE_NOTES[key] ?? null;
}
