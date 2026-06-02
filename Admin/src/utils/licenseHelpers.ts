export type LicenseRecord = {
  id: string;
  licenseKey?: string;
  assignedToEmail?: string;
  maxActivations?: number;
  activationsCount?: number;
  devices?: Record<string, unknown>;
  expiryDate?: number | null;
  revoked?: boolean;
  isActive?: boolean;
  note?: string;
  createdAt?: number | null;
  lastSeenAt?: number | null;
  gatewayValidUntil?: number | null;
  gatewayUpdatesEntitled?: boolean;
  multiUserLan?: boolean;
};

export function resolveLicenseByKey(
  licenseKey: string,
  licenseByKey: Map<string, LicenseRecord>,
  allLicenses: LicenseRecord[]
): LicenseRecord | undefined {
  const k = String(licenseKey ?? '').trim().toUpperCase();
  if (!k) return undefined;
  const hit = licenseByKey.get(k);
  if (hit) return hit;
  return allLicenses.find((l) => String(l.id ?? l.licenseKey ?? '').trim().toUpperCase() === k);
}

export function gatewayValidUntilMs(userGw: number | null | undefined, lic?: LicenseRecord): number | null {
  if (userGw != null && Number.isFinite(Number(userGw))) return Number(userGw);
  if (lic?.gatewayValidUntil != null) {
    const ms = parseToMs(lic.gatewayValidUntil);
    if (ms != null) return ms;
  }
  return null;
}

export function deviceCount(lic: LicenseRecord): number {
  const d = lic.devices;
  if (!d || typeof d !== 'object') return 0;
  return Object.keys(d).length;
}

export function maskKey(key: string): string {
  const k = String(key ?? '').trim();
  if (k.length <= 14) return k;
  return `${k.slice(0, 10)}…${k.slice(-4)}`;
}

function parseToMs(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

export function formatTs(ms: number | null | undefined): string {
  const n = ms == null ? null : parseToMs(ms) ?? (Number.isFinite(ms) ? ms : null);
  if (n == null) return '—';
  return new Date(n).toLocaleString();
}

/** Earliest device `activatedAt` on the license (first activation). */
export function firstActivationMs(lic: LicenseRecord): number | null {
  const devices = lic.devices;
  if (!devices || typeof devices !== 'object') return null;
  let earliest: number | null = null;
  for (const entry of Object.values(devices)) {
    if (!entry || typeof entry !== 'object') continue;
    const ms = parseToMs((entry as Record<string, unknown>).activatedAt);
    if (ms == null) continue;
    if (earliest == null || ms < earliest) earliest = ms;
  }
  return earliest;
}

export function generatedAtMs(lic: LicenseRecord): number | null {
  return parseToMs(lic.createdAt);
}

/** Active = assigned + at least one device (or explicitly isActive), not revoked. */
export function isLicenseActive(lic: LicenseRecord): boolean {
  if (lic.revoked) return false;
  const email = String(lic.assignedToEmail ?? '').trim();
  const devices = deviceCount(lic);
  if (lic.isActive === true && email) return true;
  return Boolean(email && devices > 0);
}

/** Generated key not yet assigned + activated (shown on Licenses tab only). */
export function isPendingGeneratedLicense(lic: LicenseRecord): boolean {
  if (lic.revoked) return false;
  return !isLicenseActive(lic);
}

export function licenseStatusLabel(lic: LicenseRecord): 'Active' | 'Inactive' | 'Revoked' | 'Pending' {
  if (lic.revoked) return 'Revoked';
  if (isLicenseActive(lic)) return 'Active';
  return 'Pending';
}

/** Latest device or license heartbeat on the license doc. */
export function licenseLastSeenMs(lic: LicenseRecord): number | null {
  let latest = parseToMs(lic.lastSeenAt);
  const devices = lic.devices;
  if (devices && typeof devices === 'object') {
    for (const entry of Object.values(devices)) {
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as Record<string, unknown>;
      for (const key of ['lastSeenAt', 'lastSeen'] as const) {
        const ms = parseToMs(row[key]);
        if (ms != null && (latest == null || ms > latest)) latest = ms;
      }
    }
  }
  return latest;
}

export function userLastActiveMs(
  user: { lastLogin?: unknown; lastActiveAt?: unknown },
  lic?: LicenseRecord
): number | null {
  let latest = parseToMs(user.lastActiveAt) ?? parseToMs(user.lastLogin);
  const loginMs = parseToMs(user.lastLogin);
  if (loginMs != null && (latest == null || loginMs > latest)) latest = loginMs;
  if (lic) {
    const licMs = licenseLastSeenMs(lic);
    if (licMs != null && (latest == null || licMs > latest)) latest = licMs;
  }
  return latest;
}

export function isRecentlyActive(ms: number | null | undefined, withinDays: number): boolean {
  if (ms == null) return false;
  return ms >= Date.now() - withinDays * 24 * 60 * 60 * 1000;
}
