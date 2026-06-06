import { createContext, useContext, useEffect, useState } from 'react';
import { supabaseCustomer } from './supabaseCustomer';
import type { User } from '@supabase/supabase-js';

interface CustomerAuthContextType {
  customer: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string, phone: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseCustomer.auth.getSession().then(({ data: { session } }) => {
      setCustomer(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabaseCustomer.auth.onAuthStateChange((_, session) => {
      setCustomer(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabaseCustomer.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signUp = async (email: string, password: string, name: string, phone: string) => {
    const { error } = await supabaseCustomer.auth.signUp({
      email,
      password,
      options: { data: { name, phone } },
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabaseCustomer.auth.signOut();
    setCustomer(null);
  };

  return (
    <CustomerAuthContext.Provider value={{ customer, loading, signIn, signUp, signOut }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
}
