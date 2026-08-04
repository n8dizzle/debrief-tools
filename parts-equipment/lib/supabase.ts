import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Client-side Supabase client (uses anon key)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;

// Server-side Supabase client (uses secret/service key — never expose to client)
//
// No anon-key fallback on purpose. Every pe_* and portal_* table has RLS ON with
// no policies, so the publishable key cannot read a single row. Falling back to it
// wouldn't degrade gracefully — it would return empty result sets everywhere,
// including the portal_users lookup in lib/auth.ts, so nobody could log in while
// every route still answered 200 with empty boards. Fail loudly instead.
//
// Throwing here is safe because every call site is inside a request handler
// (route handlers, authorize(), pe-st-note) — never at module scope. That keeps a
// misconfiguration a 500 on one route rather than an SSR boot crash (cf. #198).
export function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    const missing = [
      !url && 'NEXT_PUBLIC_SUPABASE_URL',
      !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
    ].filter(Boolean).join(', ');
    throw new Error(
      `Supabase server client misconfigured — missing ${missing}. ` +
      `Both are required: RLS is enabled on all pe_*/portal_* tables, so the ` +
      `publishable key cannot read any table.`
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
