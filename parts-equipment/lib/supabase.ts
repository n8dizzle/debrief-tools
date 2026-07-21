import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Which Postgres schema this deployment reads/writes. Prod = 'public'. A sandbox
// deployment sets NEXT_PUBLIC_PE_DB_SCHEMA=sandbox to run against an isolated copy
// of the pe_* tables + portal_users — so workflows can be explored without touching
// live data or colliding with live users. NEXT_PUBLIC_ so it applies client + server.
export const DB_SCHEMA = process.env.NEXT_PUBLIC_PE_DB_SCHEMA || 'public';

// Client-side Supabase client (uses anon key)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { db: { schema: DB_SCHEMA } })
  : null as any;

// Server-side Supabase client (uses service role key — never expose to client)
export function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const key = serviceRoleKey || anonKey;
  return createClient(url, key, {
    db: { schema: DB_SCHEMA },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
