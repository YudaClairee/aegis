import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthResult {
  user: User | null;
  error: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
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
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setError(authError.message);
    }
    setUser(data.user ?? null);
    setLoading(false);
    return { user: data.user ?? null, error: authError?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) {
      setError(authError.message);
    }
    setUser(data.user ?? null);
    setLoading(false);
    return { user: data.user ?? null, error: authError?.message ?? null };
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
