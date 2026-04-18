export const GITHUB_UPDATE_OWNER = 'pkg-pkg-pkg';
export const GITHUB_UPDATE_REPO = 'invoicePro-Update';

export function githubReleaseInstallerDownloadUrl(version: string, fileName: string): string {
  const v = String(version ?? '').trim();
  const tag = v.startsWith('v') ? v : `v${v}`;
  const base = `https://github.com/${GITHUB_UPDATE_OWNER}/${GITHUB_UPDATE_REPO}/releases/download/${encodeURIComponent(tag)}`;
  return `${base}/${encodeURIComponent(fileName)}`;
}

export function defaultWindowsSetupFileName(version: string): string {
  const v = String(version ?? '').trim().replace(/^v/i, '');
  return `PVE InvoicePro 360-Setup-${v}.exe`;
}
