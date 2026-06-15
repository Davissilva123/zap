import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
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

export type AdminRole = 'super' | 'full' | 'limited' | null;

interface AuthCtx {
  user: User | null;
  loading: boolean;
  isOperator: boolean;
  operatorInfo: OperatorInfo | null;
  adminRole: AdminRole;
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

const SUPER_ADMIN_EMAIL = (import.meta.env.VITE_SUPER_ADMIN_EMAIL ?? 'sdavi6790@gmail.com').toLowerCase();

async function detectAndSetup(su: SupabaseUser): Promise<{ isOperator: boolean; operatorInfo: OperatorInfo | null; adminRole: AdminRole }> {
  // Super admin — never creates restaurant settings
  if ((su.email ?? '').toLowerCase() === SUPER_ADMIN_EMAIL) {
    return { isOperator: false, operatorInfo: null, adminRole: 'super' };
  }

  // Operator (garçom, caixa, cozinha)
  const opInfo = await db.getOperatorByEmail(su.email ?? '');
  if (opInfo) {
    await supabase
      .from('operators')
      .update({ user_id: su.id })
      .eq('email', (su.email ?? '').toLowerCase())
      .is('user_id', null);
    return { isOperator: true, operatorInfo: opInfo, adminRole: null };
  }

  // Admin team member
  const { data: roleData } = await supabase.rpc('get_my_admin_role', { p_email: su.email ?? '' });
  if (roleData) {
    return { isOperator: false, operatorInfo: null, adminRole: roleData as 'full' | 'limited' };
  }

  // Regular restaurant owner
  await db.ensureSettings(su.id, (su.user_metadata?.name as string) ?? su.email ?? '');
  return { isOperator: false, operatorInfo: null, adminRole: null };
}

const FALLBACK: { isOperator: boolean; operatorInfo: OperatorInfo | null; adminRole: AdminRole } = {
  isOperator: false, operatorInfo: null, adminRole: null,
};

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
  const [adminRole, setAdminRole] = useState<AdminRole>(null);

  // Ref to track whether role detection has already been done for this session.
  // Prevents re-running detectAndSetup on TOKEN_REFRESHED, reconnects, etc.
  const detectedRef = useRef(false);

  useEffect(() => {
    const safetyTimer = setTimeout(() => setLoading(false), 8000);

    // Initial session check — runs detectAndSetup once
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) console.error('[Auth] getSession error:', error);
      if (session?.user && !detectedRef.current) {
        detectedRef.current = true; // mark before await to block concurrent runs
        const { isOperator: op, operatorInfo: opInfo, adminRole: ar } = await safeDetectAndSetup(session.user);
        setIsOperator(op);
        setOperatorInfo(opInfo);
        setAdminRole(ar);
        setUser(toUser(session.user));
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
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        // Logout: limpa tudo e permite nova detecção no próximo login
        if (event === 'SIGNED_OUT' || !session?.user) {
          detectedRef.current = false;
          setUser(null);
          setIsOperator(false);
          setOperatorInfo(null);
          setAdminRole(null);
          return;
        }

        // Se já detectamos o papel, apenas atualiza o token do usuário.
        // Isso previne re-detecção em TOKEN_REFRESHED, INITIAL_SESSION,
        // reconexões de rede e qualquer outro evento que não seja um login real.
        if (detectedRef.current) {
          setUser(toUser(session.user));
          return;
        }

        // Primeira detecção (SIGNED_IN sem getSession ter rodado antes)
        detectedRef.current = true;
        const { isOperator: op, operatorInfo: opInfo, adminRole: ar } = await safeDetectAndSetup(session.user);
        setIsOperator(op);
        setOperatorInfo(opInfo);
        setAdminRole(ar);
        setUser(toUser(session.user));
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
    const referredBy = localStorage.getItem('zm_ref') || undefined;
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name, ...(referredBy ? { referredBy } : {}) } },
    });
    if (error) {
      if (error.message.toLowerCase().includes('already registered')) return 'Este e-mail já está cadastrado';
      return error.message;
    }
    if (data.user) {
      await Promise.resolve(supabase.rpc('create_trial_plan', { p_user_id: data.user.id })).catch(() => {});
      // E-mail de boas-vindas (fire and forget)
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      fetch(`${SUPABASE_URL}/functions/v1/send-welcome-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ name: name.trim(), email, dashboardUrl: `${window.location.origin}/dashboard` }),
      }).catch(() => {});
      if (referredBy) localStorage.removeItem('zm_ref');
    }
    return null;
  };

  const logout = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, isOperator, operatorInfo, adminRole, login, register, logout }}>
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
