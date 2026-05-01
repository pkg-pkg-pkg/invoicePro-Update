import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_STORAGE_KEY = 'pve_mobile_auth_v1';

export type StoredAuth = {
  token: string;
  user: {
    id: string;
    username: string;
    fullName?: string;
    mobileNumber?: string;
    role?: string;
    companyId?: string;
    mobilePermissions?: Record<string, unknown>;
  };
};

export async function saveAuthSession(payload: StoredAuth): Promise<void> {
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
}

export async function readAuthSession(): Promise<StoredAuth | null> {
  const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
}

