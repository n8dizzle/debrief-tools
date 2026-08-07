import { createClient } from '@supabase/supabase-js';

// Server-only. There is deliberately no browser client and no anon-key fallback:
// rg_* tables have RLS on with no policies, so the publishable key (which ships in
// the browser bundle) can read nothing. A fallback would return empty results
// everywhere instead of erroring — the exact silent failure that hid bugs in the
// other apps. Fail loudly, name the missing variable.
export function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const missing = [!url && 'NEXT_PUBLIC_SUPABASE_URL', !key && 'SUPABASE_SERVICE_ROLE_KEY']
      .filter(Boolean).join(', ');
    throw new Error(`Supabase not configured — missing ${missing}.`);
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
