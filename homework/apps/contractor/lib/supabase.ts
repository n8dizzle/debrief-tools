import { createBrowserClient as createBrowser } from '@supabase/ssr';

// Placeholders allow build to succeed without env vars (real values injected at deploy time)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export function createBrowserClient() {
  return createBrowser(supabaseUrl, supabaseAnonKey);
}
