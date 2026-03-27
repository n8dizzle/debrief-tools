// @homework/shared auth
// Supabase Auth helpers for the Homework marketplace.
// Uses Supabase Auth (not NextAuth) because public users need
// email/password, magic link, and social login.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile, UserRole } from './types';

// ---------------------------------------------------------------------------
// Client creation
// ---------------------------------------------------------------------------

/**
 * Create a Supabase client for browser usage (anon key).
 * Uses NEXT_PUBLIC_ env vars so the values are available client-side.
 */
export function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

/**
 * Create a Supabase client with the service role key for server-side usage.
 * This bypasses RLS - use only in server components, API routes, and cron jobs.
 * NEVER expose the service role key to the browser.
 */
export function createSupabaseServerClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Missing Supabase server env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Get the currently authenticated user and their profile.
 * Returns null if not authenticated.
 *
 * Usage:
 *   const user = await getCurrentUser(supabase);
 *   if (!user) redirect('/login');
 */
export async function getCurrentUser(
  supabase: SupabaseClient
): Promise<{ authUser: { id: string; email: string }; profile: UserProfile } | null> {
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser || !authUser.email) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return {
    authUser: { id: authUser.id, email: authUser.email },
    profile: profile as UserProfile,
  };
}

/**
 * Middleware helper: require an authenticated user.
 * Returns the user profile or a 401 Response.
 *
 * Usage in an API route:
 *   const result = await requireAuth(supabase);
 *   if (result instanceof Response) return result;
 *   const { authUser, profile } = result;
 */
export async function requireAuth(
  supabase: SupabaseClient
): Promise<{ authUser: { id: string; email: string }; profile: UserProfile } | Response> {
  const user = await getCurrentUser(supabase);

  if (!user) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (user.profile.status !== 'active') {
    return new Response(
      JSON.stringify({ error: { code: 'ACCOUNT_INACTIVE', message: 'Account is not active' } }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return user;
}

/**
 * Middleware helper: require a specific role.
 * Returns the user profile or a 403 Response.
 *
 * Usage in an API route:
 *   const result = await requireRole(supabase, 'admin');
 *   if (result instanceof Response) return result;
 *   const { authUser, profile } = result;
 *
 * Role hierarchy: admin > contractor > homeowner
 * Admin can access everything; contractor routes block homeowners.
 */
export async function requireRole(
  supabase: SupabaseClient,
  role: UserRole
): Promise<{ authUser: { id: string; email: string }; profile: UserProfile } | Response> {
  const authResult = await requireAuth(supabase);
  if (authResult instanceof Response) return authResult;

  const { profile } = authResult;

  const roleHierarchy: Record<UserRole, number> = {
    homeowner: 0,
    contractor: 1,
    admin: 2,
  };

  const userLevel = roleHierarchy[profile.role];
  const requiredLevel = roleHierarchy[role];

  if (userLevel < requiredLevel) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'FORBIDDEN',
          message: `This action requires the '${role}' role`,
        },
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return authResult;
}

// Re-export UserRole type for convenience
export type { UserRole } from './types';
