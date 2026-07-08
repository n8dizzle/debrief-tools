import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Server-side Supabase client (service role key, bypasses RLS).
// Only use in API routes / server components, never expose to the client.
// Guarded so a missing env var doesn't throw at import time (createClient('') throws).
export function getServerSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey && supabaseUrl) {
    return createClient(supabaseUrl, serviceRoleKey);
  }
  if (supabaseUrl && supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  throw new Error('Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL / keys)');
}

// ---- Portal types (shared shape with the rest of the apps) ----
export interface PortalUser {
  id: string;
  email: string;
  name: string | null;
  role: 'employee' | 'manager' | 'owner';
  is_active: boolean;
}

// ---- Phase 0 spike types (throwaway; NOT part of the train_* schema) ----
export interface SpikeTap {
  id: string;
  token: string;
  tech_name: string | null;
  phone: string | null;
  sent_at: string | null;
  send_status: 'accepted' | 'failed' | null;
  send_error: string | null;
  provider_msg_id: string | null;
  tapped_at: string | null;
  tap_count: number;
  completed_at: string | null;
  created_at: string;
}
