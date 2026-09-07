/** Service-role client. Server only. Bypasses RLS — use for device flow, submit, and reads. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from './env';

// Untyped schema on purpose: tables are small and validated at the edges.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
let cached: SupabaseClient<Db> | null = null;

export function supabaseAdmin(): SupabaseClient<Db> {
  if (!cached) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase is not configured');
    cached = createClient<Db>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
