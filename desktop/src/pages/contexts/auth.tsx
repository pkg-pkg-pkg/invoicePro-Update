// D:\PVEB\desktop\src\pages\contexts\auth.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/firebase";
import { syncHostMultiUserLanFromCloud } from "../../services/hostLicenseSyncService";
import {
  ensureLegacyDesktopSession,
  logoutDesktopSession,
  validateDesktopSession,
  type SessionUser,
} from "../../services/sessionManager";
import { subscribeUserDisplayName } from "../../services/userDisplayNameService";
import { isElectronRuntime } from "../../utils/runtime";
import { withTimeout } from "../../utils/withTimeout";
import { syncBusinessProfileOnLogin } from "../../services/businessProfileService";
import { getCachedCompanyProfile } from "../../services/companyProfileDbService";
import {
  clearAuthStorage,
  persistAuthSession,
  readStoredAuthToken,
  readStoredAuthUserRaw,
  updateStoredAuthUser,
} from "../../utils/authStorage";
import { auditService } from "../../services/audit/auditService";

interface Company {
  id: string;
  name: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  companyId: string;
  company: Company | null;
  completedBusinessProfile?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

function enrichCompletedBusinessProfile(user: User): User {
  const dbProfile = isElectronRuntime() ? getCachedCompanyProfile() : null;
  const dbComplete = Boolean(
    dbProfile?.businessName && dbProfile?.address && dbProfile?.phone
  );
  if (user.completedBusinessProfile || dbComplete) {
    return { ...user, completedBusinessProfile: true };
  }
  try {
    const savedUser = readStoredAuthUserRaw();
    if (savedUser) {
      const parsed = JSON.parse(savedUser) as User;
      if (parsed.completedBusinessProfile) {
        return { ...user, completedBusinessProfile: true };
      }
    }
  } catch {
    // ignore
  }
  return user;
}

function sessionUserToAuthUser(u: SessionUser): User {
  return enrichCompletedBusinessProfile({
    id: u.id,
    username: u.username,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    companyId: u.companyId || '',
    company: null,
    completedBusinessProfile: u.completedBusinessProfile,
  });
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      try {
        if (isElectronRuntime()) {
          const session = await withTimeout(validateDesktopSession(), 6000, {
            valid: false,
            reason: 'session_validate_timeout',
          });
          if (!cancelled && session.valid && session.user && session.sessionToken) {
            const authUser = sessionUserToAuthUser(session.user as SessionUser);
            setToken(session.sessionToken);
            setUser(authUser);
            persistAuthSession(
              session.sessionToken,
              JSON.stringify(authUser),
              localStorage.getItem('remember_me') === '1'
            );
            setLoading(false);
            setTimeout(() => {
              void syncBusinessProfileOnLogin(authUser.email).then((completed) => {
                if (!completed) return;
                setUser((prev) => {
                  if (!prev || prev.completedBusinessProfile) return prev;
                  const next = { ...prev, completedBusinessProfile: true };
                  updateStoredAuthUser(JSON.stringify(next));
                  return next;
                });
              });
            }, 3000);
            return;
          }
        }

        const savedToken = readStoredAuthToken();
        const savedUser = readStoredAuthUserRaw();

        if (savedToken && savedUser) {
          const parsedUser: User = JSON.parse(savedUser);
          if (isElectronRuntime()) {
            const legacy = await ensureLegacyDesktopSession({
              userId: parsedUser.id,
              username: parsedUser.username,
              email: parsedUser.email,
              fullName: parsedUser.fullName,
            });
            if (!cancelled && legacy.valid && legacy.sessionToken && legacy.user) {
              const authUser = sessionUserToAuthUser(legacy.user as SessionUser);
              setToken(legacy.sessionToken);
              setUser(authUser);
              persistAuthSession(
                legacy.sessionToken,
                JSON.stringify(authUser),
                localStorage.getItem('remember_me') === '1'
              );
              setLoading(false);
              return;
            }
          }
          if (!cancelled) {
            setToken(savedToken);
            setUser(enrichCompletedBusinessProfile(parsedUser));
          }
        }
      } catch (err) {
        console.error("Failed to restore session", err);
        clearAuthStorage();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    return subscribeUserDisplayName(user.id, user.email, (name) => {
      setUser((prev) => {
        if (!prev || prev.fullName === name) return prev;
        const next = { ...prev, fullName: name };
        updateStoredAuthUser(JSON.stringify(next));
        return next;
      });
    });
  }, [user?.id, user?.email]);

  const login = useCallback(async (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    persistAuthSession(
      newToken,
      JSON.stringify(newUser),
      localStorage.getItem('remember_me') === '1'
    );
    void auditService.logLogin();
  }, []);

  const logout = useCallback(() => {
    void auditService.logLogout();
    setToken(null);
    setUser(null);
    clearAuthStorage();
    void logoutDesktopSession();
    void signOut(auth).catch(() => undefined);
    void syncHostMultiUserLanFromCloud(false);
  }, []);

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token && !!user,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
