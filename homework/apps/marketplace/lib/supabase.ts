import { createBrowserClient as createBrowserSupabaseClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

/**
 * Creates a Supabase client for use in browser/client components.
 */
export function createBrowserClient() {
  return createBrowserSupabaseClient(supabaseUrl, supabaseAnonKey);
}
