// utils/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client for server-side routes only.
 * WARNING: Do not import this in client components.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'vetta-admin' } }
  }
);
