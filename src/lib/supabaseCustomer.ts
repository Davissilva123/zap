import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Separate client with its own storage key so customer sessions
// don't conflict with the restaurant owner session.
export const supabaseCustomer = createClient(url, key, {
  auth: { storageKey: 'zapmenu-customer-auth' },
});
