import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { User, UserRole, users as mockUsers } from '@/lib/mockData';
import { isApiConfigured, getApiBase, getToken, setToken, clearSession, USER_STORAGE_KEY } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (action: 'add' | 'edit' | 'delete' | 'view') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const permissions: Record<UserRole, string[]> = {
  admin: ['add', 'edit', 'delete', 'view'],
  staff: ['add', 'edit', 'view'],
  viewer: ['view'],
};

function loadStoredUser(): User | null {
  if (!isApiConfigured()) return null;
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw || !getToken()) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadStoredUser());

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('inveto:session-expired', onExpired);
    return () => window.removeEventListener('inveto:session-expired', onExpired);
  }, []);

  const tryMockLogin = (email: string, password: string) => {
    const found = mockUsers.find((u) => u.email === email && u.password === password);
    if (!found) return null;
    setUser(found);
    return { success: true as const };
  };

  const login = useCallback(async (email: string, password: string) => {
    if (isApiConfigured()) {
      const base = getApiBase() ?? '';
      try {
        const res = await fetch(`${base}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          token?: string;
          user?: User;
          error?: string;
        };
        if (!res.ok || !data.token || !data.user) {
          // Proxy/backend down often returns 5xx with no token — use same demo accounts offline
          const proxyOrServerDown =
            res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504;
          if (proxyOrServerDown) {
            const offline = tryMockLogin(email, password);
            if (offline) {
              console.warn(
                '[INVETO] API unavailable; signed in with demo account (local mock data only). Start the backend and run npm run seed to use the database.'
              );
              return offline;
            }
          }
          return { success: false as const, error: data.error || 'Login failed' };
        }
        setToken(data.token);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
        setUser({ ...data.user, password: '' });
        return { success: true as const };
      } catch {
        const offline = tryMockLogin(email, password);
        if (offline) {
          console.warn(
            '[INVETO] Cannot reach API; signed in with demo account (local mock data only). Run: npm run dev:full from the repo root (or npm run api in another terminal).'
          );
          return offline;
        }
        return {
          success: false as const,
          error:
            'Cannot reach API. Start the backend (e.g. npm run api from repo root), ensure MongoDB is running, then run npm run seed once. Or use Sign In only after the API is up.',
        };
      }
    }

    const found = mockUsers.find((u) => u.email === email && u.password === password);
    if (found) {
      setUser(found);
      return { success: true as const };
    }
    return { success: false as const, error: 'Invalid email or password' };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    clearSession();
  }, []);

  const hasPermission = useCallback((action: string) => {
    if (!user) return false;
    return permissions[user.role].includes(action);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
