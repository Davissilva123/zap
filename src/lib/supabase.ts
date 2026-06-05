import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Variáveis de ambiente não encontradas:', { supabaseUrl, supabaseAnonKey });
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');
