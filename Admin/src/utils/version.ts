export function parseSemver(s: string): number[] {
  const m = String(s ?? '')
    .trim()
    .match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return [0, 0, 0];
  return [Number(m[1]) || 0, Number(m[2]) || 0, Number(m[3]) || 0];
}

/** True if current is older than latest (semver-like). */
export function isOlderVersion(current: string, latest: string): boolean {
  const a = parseSemver(current);
  const b = parseSemver(latest);
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}

export function needsAppUpdate(userVersion: string, latestVersion: string): boolean {
  const latest = String(latestVersion ?? '').trim();
  if (!latest) return false;
  const current = String(userVersion ?? '').trim();
  if (!current) return true;
  return isOlderVersion(current, latest);
}
