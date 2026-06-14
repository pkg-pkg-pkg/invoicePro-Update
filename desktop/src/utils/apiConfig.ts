const DEV_API_FALLBACK = 'http://localhost:3000/api';

function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed.replace(/\/$/, '')}/api`;
}

/** Resolves REST API base URL (`…/api`). Throws in production when unset. */
export function resolveApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (raw) return normalizeApiBaseUrl(raw);
  if (import.meta.env.PROD) {
    throw new Error('VITE_API_URL is not configured. Set it in your environment before building.');
  }
  return DEV_API_FALLBACK;
}

/** Origin without `/api` suffix (for slices that call host root). */
export function resolveApiOrigin(): string {
  return resolveApiBaseUrl().replace(/\/api\/?$/, '');
}
