import AsyncStorage from '@react-native-async-storage/async-storage';
import { MIDDLEWARE_URL } from '@env';

export const MIDDLEWARE_URL_STORAGE_KEY = 'middleware_url';

let cachedOrigin = '';

function normalizeOrigin(url: string): string {
  let value = url.trim().replace(/\/+$/, '');
  value = value.replace(/^MIDDLEWARE_URL=/i, '');
  return value;
}

/** Origin from @env only — configure in .env or Settings on device. */
export function getEnvMiddlewareOrigin(): string {
  return normalizeOrigin(String(MIDDLEWARE_URL || ''));
}

/** Current middleware origin (host:port, no /api suffix). */
export function getMiddlewareOrigin(): string {
  return cachedOrigin || getEnvMiddlewareOrigin();
}

export function getMiddlewareApiBase(): string {
  const origin = getMiddlewareOrigin();
  return origin ? `${origin}/api` : '';
}

/**
 * Load URL on app start: AsyncStorage → @env.
 * Returns the resolved origin (may be empty until configured).
 */
export async function initMiddlewareUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(MIDDLEWARE_URL_STORAGE_KEY);
    if (stored?.trim()) {
      cachedOrigin = normalizeOrigin(stored);
      return cachedOrigin;
    }
  } catch {
    // ignore
  }
  cachedOrigin = getEnvMiddlewareOrigin();
  return cachedOrigin;
}

/** Persist user override and update in-memory cache. */
export async function setMiddlewareUrl(url: string | null): Promise<string> {
  if (url?.trim()) {
    cachedOrigin = normalizeOrigin(url);
    await AsyncStorage.setItem(MIDDLEWARE_URL_STORAGE_KEY, cachedOrigin);
  } else {
    cachedOrigin = getEnvMiddlewareOrigin();
    await AsyncStorage.removeItem(MIDDLEWARE_URL_STORAGE_KEY);
  }
  return cachedOrigin;
}
