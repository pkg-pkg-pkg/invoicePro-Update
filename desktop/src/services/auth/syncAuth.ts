import { storageDriver } from '../storage/storageDriver';

const SYNC_TOKEN_KEY = 'pve_sync_token';
const SYNC_SESSION_KEY = 'pve_sync_session';

export interface SyncSession {
  userId: string;
  username: string;
  role: string;
  companyId: string;
  token: string;
  expiresAt: number;
  refreshToken?: string;
}

const encode = (data: string): string => {
  try {
    return btoa(encodeURIComponent(data));
  } catch {
    return data;
  }
};

const decode = (data: string): string => {
  try {
    return decodeURIComponent(atob(data));
  } catch {
    return data;
  }
};

const generateToken = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

export const syncAuth = {
  async createSession(user: {
    id: string;
    username: string;
    role: string;
    companyId?: string;
  }): Promise<SyncSession> {
    const token = generateToken();
    const refreshToken = generateToken();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    const session: SyncSession = {
      userId: user.id,
      username: user.username,
      role: user.role,
      companyId: user.companyId ?? '',
      token,
      expiresAt,
      refreshToken,
    };

    await storageDriver.write(SYNC_TOKEN_KEY, encode(token));
    await storageDriver.write(SYNC_SESSION_KEY, encode(JSON.stringify(session)));

    return session;
  },

  async getSession(): Promise<SyncSession | null> {
    try {
      const encoded = await storageDriver.read<string>(SYNC_SESSION_KEY, '');
      if (!encoded) return null;

      const session: SyncSession = JSON.parse(decode(encoded));
      if (session.expiresAt < Date.now()) {
        await this.clearSession();
        return null;
      }

      return session;
    } catch {
      return null;
    }
  },

  async getToken(): Promise<string | null> {
    const session = await this.getSession();
    return session?.token ?? null;
  },

  async validateToken(token: string): Promise<SyncSession | null> {
    const session = await this.getSession();
    if (!session) return null;
    if (session.token !== token) return null;
    if (session.expiresAt < Date.now()) return null;
    return session;
  },

  async refreshSession(): Promise<SyncSession | null> {
    const session = await this.getSession();
    if (!session || !session.refreshToken) return null;

    const newToken = generateToken();
    const newExpiresAt = Date.now() + 24 * 60 * 60 * 1000;

    const newSession: SyncSession = {
      ...session,
      token: newToken,
      expiresAt: newExpiresAt,
    };

    await storageDriver.write(SYNC_TOKEN_KEY, encode(newToken));
    await storageDriver.write(SYNC_SESSION_KEY, encode(JSON.stringify(newSession)));

    return newSession;
  },

  async clearSession(): Promise<void> {
    await storageDriver.remove(SYNC_TOKEN_KEY);
    await storageDriver.remove(SYNC_SESSION_KEY);
  },

  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  },

  getAuthHeaders(): Record<string, string> {
    try {
      const raw = localStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;
      const token = localStorage.getItem('token') || 'local';
      return {
        'X-Sync-Token': token,
        'X-Sync-User': user?.id ?? '',
        'X-Sync-Company': user?.companyId ?? '',
      };
    } catch {
      return {};
    }
  },
};
