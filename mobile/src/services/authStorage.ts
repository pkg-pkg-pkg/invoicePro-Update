import AsyncStorage from '@react-native-async-storage/async-storage';

const JWT_KEY = 'jwt_token';
const REFRESH_KEY = 'refresh_token';
const USER_KEY = 'user';
const LEGACY_AUTH_KEY = 'pve_mobile_auth_v1';

export type StoredAuthUser = {
  id: string;
  username: string;
  name?: string;
  fullName?: string;
  mobileNumber?: string;
  role?: string;
  companyId?: string;
  permissions?: string[];
  mobilePermissions?: Record<string, unknown>;
};

export type StoredAuth = {
  token: string;
  refreshToken?: string;
  user: StoredAuthUser;
};

export function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    if (!payload.exp) return false;
    return Date.now() / 1000 >= payload.exp;
  } catch {
    return true;
  }
}

export async function saveAuthSession(payload: StoredAuth): Promise<void> {
  const entries: [string, string][] = [
    [JWT_KEY, payload.token],
    [USER_KEY, JSON.stringify(payload.user)],
  ];
  if (payload.refreshToken) {
    entries.push([REFRESH_KEY, payload.refreshToken]);
  }
  await AsyncStorage.multiSet(entries);
}

export async function readAuthSession(): Promise<StoredAuth | null> {
  const pairs = await AsyncStorage.multiGet([JWT_KEY, REFRESH_KEY, USER_KEY]);
  const token = pairs[0][1];
  const refreshToken = pairs[1][1] ?? undefined;
  const userRaw = pairs[2][1];
  if (!token || !userRaw) return null;
  try {
    const user = JSON.parse(userRaw) as StoredAuthUser;
    if (!user?.id) return null;
    return { token, refreshToken, user };
  } catch {
    return null;
  }
}

export async function restoreAuthSession(): Promise<StoredAuth | null> {
  const session = await readAuthSession();
  if (!session?.token) return null;
  if (isJwtExpired(session.token)) return null;
  return session;
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.multiRemove([JWT_KEY, REFRESH_KEY, USER_KEY, LEGACY_AUTH_KEY]);
}
