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
import { isElectronRuntime } from "../../utils/runtime";
import { withTimeout } from "../../utils/withTimeout";

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

function sessionUserToAuthUser(u: SessionUser): User {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    companyId: u.companyId || '',
    company: null,
    completedBusinessProfile: u.completedBusinessProfile,
  };
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
            localStorage.setItem('token', session.sessionToken);
            localStorage.setItem('user', JSON.stringify(authUser));
            setLoading(false);
            return;
          }
        }

        const savedToken = localStorage.getItem("token");
        const savedUser = localStorage.getItem("user");

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
              localStorage.setItem('token', legacy.sessionToken);
              localStorage.setItem('user', JSON.stringify(authUser));
              setLoading(false);
              return;
            }
          }
          if (!cancelled) {
            setToken(savedToken);
            setUser(parsedUser);
          }
        }
      } catch (err) {
        console.error("Failed to restore session", err);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
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
