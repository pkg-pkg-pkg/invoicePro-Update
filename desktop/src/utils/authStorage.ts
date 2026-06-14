const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const REMEMBER_KEY = 'remember_me';

function readFrom(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

export function readStoredAuthToken(): string | null {
  return (
    readFrom(sessionStorage, TOKEN_KEY) ??
    readFrom(localStorage, TOKEN_KEY)
  );
}

export function readStoredAuthUserRaw(): string | null {
  return (
    readFrom(sessionStorage, USER_KEY) ??
    readFrom(localStorage, USER_KEY)
  );
}

export function persistAuthSession(token: string, userJson: string, rememberMe: boolean): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    const store = rememberMe ? localStorage : sessionStorage;
    store.setItem(TOKEN_KEY, token);
    store.setItem(USER_KEY, userJson);
    localStorage.setItem(REMEMBER_KEY, rememberMe ? '1' : '0');
  } catch {
    // ignore quota errors
  }
}

export function clearAuthStorage(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

export function updateStoredAuthUser(userJson: string): void {
  try {
    if (readFrom(sessionStorage, USER_KEY) != null) {
      sessionStorage.setItem(USER_KEY, userJson);
    }
    if (readFrom(localStorage, USER_KEY) != null) {
      localStorage.setItem(USER_KEY, userJson);
    }
  } catch {
    // ignore
  }
}
