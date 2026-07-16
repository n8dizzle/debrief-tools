import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Server-side Supabase client. Returns null when env vars are missing so callers
// can fall back to the seed constant instead of crashing (createClient('') throws).
export function getServerSupabase(): SupabaseClient | null {
  if (!supabaseUrl) return null;
  const key = serviceRoleKey || supabaseAnonKey;
  if (!key) return null;
  return createClient(supabaseUrl, key);
}
