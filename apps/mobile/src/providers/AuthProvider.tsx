import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { API_URL } from '../lib/env';

interface AuthResult {
  user: User | null;
  error: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, fullName?: string, phone?: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.warn('Supabase auth session error', sessionError.message);
      }
      setUser(data.session?.user ?? null);
      setLoading(false);
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.message || 'Login failed';
        setError(msg);
        setLoading(false);
        return { user: null, error: msg };
      }

      const data = await response.json();
      const { accessToken, refreshToken } = data.session;

      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return { user: null, error: sessionError.message };
      }

      setUser(sessionData.user ?? null);
      setLoading(false);
      return { user: sessionData.user ?? null, error: null };
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      setError(msg);
      setLoading(false);
      return { user: null, error: msg };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string, phone?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName: fullName || 'User',
          phone: phone || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.message || 'Registration failed';
        setError(msg);
        setLoading(false);
        return { user: null, error: msg };
      }

      const data = await response.json();
      const { accessToken, refreshToken } = data.session;

      if (accessToken && refreshToken) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setError(sessionError.message);
          setLoading(false);
          return { user: null, error: sessionError.message };
        }

        setUser(sessionData.user ?? null);
        setLoading(false);
        return { user: sessionData.user ?? null, error: null };
      } else {
        setLoading(false);
        return { user: null, error: null };
      }
    } catch (err: any) {
      const msg = err.message || 'Registration failed';
      setError(msg);
      setLoading(false);
      return { user: null, error: msg };
    }
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setLoading(false);
  };

  const value = useMemo(
    () => ({ user, loading, error, signIn, signUp, signOut }),
    [user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used inside AuthProvider');
  }
  return context;
}
