import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { getServerSupabase } from '@/lib/supabase';

// Mirrors the shared Christmas Air SSO pattern (see ar-collections/lib/auth.ts):
// Google OAuth, gated on portal_users, same NEXTAUTH_SECRET across apps so the
// .christmasair.com session cookie is shared.
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || 'christmasair.com').split(',');

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      try {
        const email = (user.email || '').toLowerCase();
        const domain = email.split('@')[1];
        if (!ALLOWED_DOMAINS.includes(domain)) {
          console.log(`Rejected sign-in from non-allowed domain: ${email}`);
          return false;
        }
        const supabase = getServerSupabase();
        if (!supabase) return true; // DB unreachable — fail open, handled in jwt
        const { data: existingUser, error } = await supabase
          .from('portal_users')
          .select('id, is_active')
          .eq('email', email)
          .single();
        if (error) {
          console.error(`Supabase error checking user: ${error.message}`);
          return true;
        }
        if (!existingUser) return '/login?error=NotRegistered';
        if (!existingUser.is_active) return '/login?error=AccountInactive';
        supabase.from('portal_users').update({ last_login_at: new Date().toISOString() }).eq('email', email);
        return true;
      } catch (err) {
        console.error('SignIn callback error:', err);
        return true;
      }
    },

    async jwt({ token, user, trigger }) {
      try {
        if (user?.email || trigger === 'update') {
          const email = (user?.email || (token.email as string))?.toLowerCase();
          const supabase = getServerSupabase();
          if (email && supabase) {
            const { data: userProfile, error } = await supabase
              .from('portal_users')
              .select('id, role, department_id, is_active, permissions')
              .eq('email', email)
              .single();
            if (error) {
              console.error('JWT callback - Supabase error:', error.message);
            } else if (userProfile) {
              token.userId = userProfile.id;
              token.role = userProfile.role;
              token.departmentId = userProfile.department_id;
              token.isActive = userProfile.is_active;
              token.permissions = userProfile.permissions;
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
        session.user.role = (token.role as 'employee' | 'manager' | 'owner') || 'employee';
        session.user.departmentId = (token.departmentId as string | null) ?? null;
        session.user.isActive = token.isActive as boolean;
        session.user.permissions = token.permissions as Record<string, Record<string, boolean>> | null;
      }
      return session;
    },
  },
  pages: { signIn: '/login', error: '/login' },
};
