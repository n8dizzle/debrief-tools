import 'server-only';
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { query } from './db';
import type { Department, UserRole } from '@/types';

const ALLOWED_DOMAINS = ['christmasair.com'];
const isProduction =
  process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL?.includes('christmasair.com');

interface UserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  department: Department | null;
  home_warehouse_id: string | null;
  assigned_truck_id: string | null;
  is_active: boolean;
  password_hash: string | null;
}

async function findUserByEmail(email: string) {
  const { rows } = await query<UserRow>(
    `SELECT id, email, first_name, last_name, role, department,
            home_warehouse_id, assigned_truck_id, is_active, password_hash
       FROM users WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
  return rows[0] ?? null;
}

const credentialsProvider =
  process.env.NEXTAUTH_ALLOW_CREDENTIALS !== 'false'
    ? [
        CredentialsProvider({
          name: 'Email & password',
          credentials: {
            email: { label: 'Email', type: 'email' },
            password: { label: 'Password', type: 'password' },
          },
          async authorize(credentials) {
            const email = credentials?.email?.toLowerCase().trim();
            const password = credentials?.password;
            if (!email || !password) return null;
            const user = await findUserByEmail(email);
            if (!user || !user.is_active || !user.password_hash) return null;
            const valid = await bcrypt.compare(password, user.password_hash);
            if (!valid) return null;
            return {
              id: user.id,
              email: user.email,
              name: `${user.first_name} ${user.last_name}`.trim(),
            };
          },
        }),
      ]
    : [];

const googleProvider =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
      ]
    : [];

export const authOptions: NextAuthOptions = {
  providers: [...googleProvider, ...credentialsProvider],

  // Share session cookie across christmasair.com subdomains in production
  cookies: isProduction
    ? {
        sessionToken: {
          name: '__Secure-next-auth.session-token',
          options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true, domain: '.christmasair.com' },
        },
        callbackUrl: {
          name: '__Secure-next-auth.callback-url',
          options: { sameSite: 'lax', path: '/', secure: true, domain: '.christmasair.com' },
        },
        csrfToken: {
          name: '__Host-next-auth.csrf-token',
          options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
        },
      }
    : undefined,

  callbacks: {
    async signIn({ account, user }) {
      const email = (user.email || '').toLowerCase();
      if (!email) return false;

      // Google: enforce company domain. Credentials: skip (already validated in authorize).
      if (account?.provider === 'google') {
        const domain = email.split('@')[1];
        if (!ALLOWED_DOMAINS.includes(domain)) {
          console.warn(`[auth] rejected non-allowed-domain sign-in: ${email}`);
          return '/login?error=AccessDenied';
        }
      }

      const dbUser = await findUserByEmail(email);
      if (!dbUser) {
        console.warn(`[auth] user not registered: ${email}`);
        return '/login?error=NotRegistered';
      }
      if (!dbUser.is_active) {
        console.warn(`[auth] inactive user attempted sign-in: ${email}`);
        return '/login?error=AccountInactive';
      }
      return true;
    },

    async jwt({ token, user, trigger }) {
      // On sign-in or session refresh, reload the user row to keep token current
      if (user?.email || trigger === 'update') {
        const email = (user?.email || (token.email as string))?.toLowerCase();
        if (email) {
          const dbUser = await findUserByEmail(email);
          if (dbUser) {
            token.userId = dbUser.id;
            token.role = dbUser.role;
            token.department = dbUser.department;
            token.homeWarehouseId = dbUser.home_warehouse_id;
            token.assignedTruckId = dbUser.assigned_truck_id;
            token.isActive = dbUser.is_active;
            token.firstName = dbUser.first_name;
            token.lastName = dbUser.last_name;
          }
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) ?? '';
        session.user.role = (token.role as UserRole) ?? 'technician';
        session.user.department = (token.department as Department | null) ?? null;
        session.user.homeWarehouseId = (token.homeWarehouseId as string | null) ?? null;
        session.user.assignedTruckId = (token.assignedTruckId as string | null) ?? null;
        session.user.isActive = (token.isActive as boolean) ?? false;
        session.user.firstName = (token.firstName as string) ?? '';
        session.user.lastName = (token.lastName as string) ?? '';
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: { strategy: 'jwt' },
};
