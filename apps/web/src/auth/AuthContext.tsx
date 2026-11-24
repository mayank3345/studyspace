import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authenticate, request } from '../lib/api';
import type { User } from '../types';

const TOKEN_KEY = 'studyspace.session';

type AuthContextValue = {
  token: string;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? '');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let active = true;
    request<{ user: User }>(token, '/api/auth/me')
      .then(({ user: currentUser }) => { if (active) setUser(currentUser); })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        if (active) { setToken(''); setUser(null); }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function saveSession(email: string, password: string, mode: 'login' | 'register') {
    const result = await authenticate(mode, email, password);
    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setUser(result.user);
  }

  async function logout() {
    try { await request(token, '/api/auth/logout', { method: 'POST' }); } catch { /* Clear the local session even if the API is offline. */ }
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(() => ({
    token,
    user,
    loading,
    login: (email, password) => saveSession(email, password, 'login'),
    register: (email, password) => saveSession(email, password, 'register'),
    logout,
  }), [token, user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
