/**
 * Shared authentication configuration for Christmas Air Internal Tools
 *
 * This provides a factory function to create NextAuth options with
 * shared cookie settings for SSO across all christmasair.com subdomains.
 */

import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserPermissions, UserRole } from './permissions';

// ============================================
// CONFIGURATION
// ============================================

const ALLOWED_DOMAINS = ['christmasair.com'];

interface AuthConfig {
  googleClientId: string;
  googleClientSecret: string;
  nextAuthUrl: string;
  nodeEnv: string;
  getSupabaseClient: () => SupabaseClient;
  signInPage?: string;
  errorPage?: string;
}

// ============================================
// SHARED COOKIE CONFIG FOR SSO
// ============================================

function getSharedCookieConfig(isProduction: boolean) {
  if (!isProduction) return undefined;

  return {
    sessionToken: {
      name: '__Secure-next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: true,
        domain: '.christmasair.com',
      },
    },
    callbackUrl: {
      name: '__Secure-next-auth.callback-url',
      options: {
        sameSite: 'lax' as const,
        path: '/',
        secure: true,
        domain: '.christmasair.com',
      },
    },
    csrfToken: {
      name: '__Host-next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: true,
      },
    },
  };
}

// ============================================
// AUTH OPTIONS FACTORY
// ============================================

/**
 * Create NextAuth options with shared SSO cookie configuration.
 * Use this in each app's lib/auth.ts file.
 *
 * @example
 * ```ts
 * // daily-dash/lib/auth.ts
 * import { createAuthOptions } from '@christmas-air/shared/auth';
 * import { getServerSupabase } from './supabase';
 *
 * export const authOptions = createAuthOptions({
 *   googleClientId: process.env.GOOGLE_CLIENT_ID!,
 *   googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
 *   nextAuthUrl: process.env.NEXTAUTH_URL!,
 *   nodeEnv: process.env.NODE_ENV!,
 *   getSupabaseClient: getServerSupabase,
 * });
 * ```
 */
export function createAuthOptions(config: AuthConfig): NextAuthOptions {
  const isProduction =
    config.nodeEnv === 'production' && config.nextAuthUrl?.includes('christmasair.com');

  return {
    providers: [
      GoogleProvider({
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
      }),
    ],
    cookies: getSharedCookieConfig(isProduction),
    callbacks: {
      async signIn({ user }) {
        try {
          const email = user.email || '';
          const domain = email.split('@')[1];

          // Check domain
          if (!ALLOWED_DOMAINS.includes(domain)) {
            console.log(`Rejected sign-in attempt from non-allowed domain: ${email}`);
            return false;
          }

          // Check if user exists in portal_users
          const supabase = config.getSupabaseClient();
          const { data: existingUser, error } = await supabase
            .from('portal_users')
            .select('id, is_active')
            .eq('email', email)
            .single();

          if (error) {
            console.error(`Supabase error checking user: ${error.message}`);
            return true; // Allow sign-in, handle in jwt callback
          }

          if (!existingUser) {
            console.log(`User not registered in portal: ${email}`);
            return `${config.signInPage || '/login'}?error=NotRegistered`;
          }

          if (!existingUser.is_active) {
            console.log(`Inactive user attempted login: ${email}`);
            return `${config.signInPage || '/login'}?error=AccountInactive`;
          }

          // Update last login (fire and forget)
          supabase
            .from('portal_users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('email', email);

          return true;
        } catch (err) {
          console.error('SignIn callback error:', err);
          return true;
        }
      },

      async jwt({ token, user, trigger }) {
        try {
          if (user?.email || trigger === 'update') {
            const email = user?.email || token.email;
            if (email) {
              const supabase = config.getSupabaseClient();
              const { data: userProfile, error } = await supabase
                .from('portal_users')
                .select(`
                  id,
                  role,
                  department_id,
                  is_active,
                  permissions,
                  portal_departments(id, name, slug)
                `)
                .eq('email', email as string)
                .single();

              if (error) {
                console.error('JWT callback - Supabase error:', error.message);
              } else if (userProfile) {
                token.userId = userProfile.id;
                token.role = userProfile.role as UserRole;
                token.departmentId = userProfile.department_id;
                token.department = userProfile.portal_departments as any;
                token.isActive = userProfile.is_active;
                token.permissions = (userProfile.permissions as UserPermissions) || null;
              }
            }
          }
        } catch (err) {
          console.error('JWT callback error:', err);
        }
        return token;
      },

      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.userId as string;
          session.user.role = (token.role as UserRole) || 'employee';
          session.user.departmentId = token.departmentId as string | null;
          session.user.department = token.department as any;
          session.user.isActive = token.isActive as boolean;
          session.user.permissions = token.permissions || null;
        }
        return session;
      },
    },
    pages: {
      signIn: config.signInPage || '/login',
      error: config.errorPage || '/login',
    },
  };
}

// ============================================
// UTILITY EXPORTS
// ============================================

export { ALLOWED_DOMAINS };
