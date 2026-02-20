// utils/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client for server-side routes only.
 * WARNING: Do not import this in client components.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in supabaseAdmin.ts'
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
  global: { headers: { 'X-Client-Info': 'vetta-admin' } },
});
