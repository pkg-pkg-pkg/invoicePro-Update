const SESSION_KEY = 'invoicepro-admin-unlocked';

export function markSessionUnlocked(): void {
  sessionStorage.setItem(SESSION_KEY, '1');
}

export function isSessionUnlocked(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function clearSessionUnlock(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
