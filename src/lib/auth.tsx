import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from './types';
import { supabase } from './supabase';
import { db } from './db';

export interface OperatorInfo {
  ownerId: string;
  role: 'admin' | 'waiter' | 'cashier' | 'kitchen';
  restaurantName: string;
  operatorName: string;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  isOperator: boolean;
  operatorInfo: OperatorInfo | null;
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

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function detectAndSetup(su: SupabaseUser): Promise<{ isOperator: boolean; operatorInfo: OperatorInfo | null }> {
  const opInfo = await db.getOperatorByEmail(su.email ?? '');
  if (opInfo) {
    await supabase
      .from('operators')
      .update({ user_id: su.id })
      .eq('email', (su.email ?? '').toLowerCase())
      .is('user_id', null);
    return { isOperator: true, operatorInfo: opInfo };
  }
  await db.ensureSettings(su.id, (su.user_metadata?.name as string) ?? su.email ?? '');
  return { isOperator: false, operatorInfo: null };
}

const FALLBACK = { isOperator: false, operatorInfo: null };

async function safeDetectAndSetup(su: SupabaseUser) {
  try {
    return await withTimeout(detectAndSetup(su), 6000, FALLBACK);
  } catch (err) {
    console.error('[Auth] detectAndSetup error:', err);
    return FALLBACK;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOperator, setIsOperator] = useState(false);
  const [operatorInfo, setOperatorInfo] = useState<OperatorInfo | null>(null);

  useEffect(() => {
    // Safety net: always clear loading after 8s no matter what
    const safetyTimer = setTimeout(() => setLoading(false), 8000);

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) console.error('[Auth] getSession error:', error);
      if (session?.user) {
        const u = toUser(session.user);
        const { isOperator: op, operatorInfo: opInfo } = await safeDetectAndSetup(session.user);
        setIsOperator(op);
        setOperatorInfo(opInfo);
        setUser(u);
      }
      clearTimeout(safetyTimer);
      setLoading(false);
    }).catch(err => {
      console.error('[Auth] getSession threw:', err);
      clearTimeout(safetyTimer);
      setLoading(false);
    });

    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const u = toUser(session.user);
          const { isOperator: op, operatorInfo: opInfo } = await safeDetectAndSetup(session.user);
          setIsOperator(op);
          setOperatorInfo(opInfo);
          setUser(u);
        } else {
          setUser(null);
          setIsOperator(false);
          setOperatorInfo(null);
        }
      });
      subscription = data.subscription;
    } catch (err) {
      console.error('[Auth] onAuthStateChange threw:', err);
    }

    return () => {
      clearTimeout(safetyTimer);
      subscription?.unsubscribe();
    };
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
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
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
    <AuthContext.Provider value={{ user, loading, isOperator, operatorInfo, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
}

/** Returns the restaurant owner's user_id regardless of whether the logged-in user is an owner or operator */
export function useRestaurantId(): string | null {
  const { user, isOperator, operatorInfo } = useAuth();
  if (isOperator && operatorInfo) return operatorInfo.ownerId;
  return user?.id ?? null;
}
