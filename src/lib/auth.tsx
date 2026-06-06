import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from './types';
import { supabase } from './supabase';
import { db } from './db';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

function toUser(su: SupabaseUser): User {
  return {
    id: su.id,
    name: (su.user_metadata?.name as string) ?? su.email ?? '',
    email: su.email ?? '',
    password: '',
    createdAt: su.created_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) console.error('[Auth] getSession error:', error);
      if (session?.user) {
        const u = toUser(session.user);
        await db.ensureSettings(u.id, u.name);
        setUser(u);
      }
      setLoading(false);
    }).catch(err => {
      console.error('[Auth] getSession threw:', err);
      setLoading(false);
    });

    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const u = toUser(session.user);
          db.ensureSettings(u.id, u.name); // fire-and-forget, callback não suporta async
          setUser(u);
        } else {
          setUser(null);
        }
      });
      subscription = data.subscription;
    } catch (err) {
      console.error('[Auth] onAuthStateChange threw:', err);
    }

    return () => subscription?.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.';
      }
      return 'E-mail ou senha incorretos';
    }
    return null;
  };

  const register = async (name: string, email: string, password: string): Promise<string | null> => {
    if (!name.trim()) return 'Nome é obrigatório';
    if (!email.trim()) return 'E-mail é obrigatório';
    if (password.length < 6) return 'Senha deve ter pelo menos 6 caracteres';

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) return 'Este e-mail já está cadastrado';
      return error.message;
    }
    return null;
  };

  const logout = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
}
