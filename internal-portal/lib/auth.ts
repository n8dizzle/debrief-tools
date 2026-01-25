import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getServerSupabase } from "@/lib/supabase";

// Allowed email domains - add your company domain(s)
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || "christmasair.com").split(",");

// Check if we're in production (on christmasair.com domain)
const isProduction = process.env.NODE_ENV === 'production' &&
  process.env.NEXTAUTH_URL?.includes('christmasair.com');

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  // Share session cookie across all christmasair.com subdomains
  cookies: isProduction ? {
    sessionToken: {
      name: '__Secure-next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
        domain: '.christmasair.com',
      },
    },
    callbackUrl: {
      name: '__Secure-next-auth.callback-url',
      options: {
        sameSite: 'lax',
        path: '/',
        secure: true,
        domain: '.christmasair.com',
      },
    },
    csrfToken: {
      name: '__Host-next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
      },
    },
  } : undefined,
  callbacks: {
    async signIn({ user }) {
      try {
        const email = user.email || "";
        const domain = email.split("@")[1];

        // Check domain first
        if (!ALLOWED_DOMAINS.includes(domain)) {
          console.log(`Rejected sign-in attempt from non-allowed domain: ${email}`);
          return false;
        }

        // Check if user exists in our portal_users table
        const supabase = getServerSupabase();
        const { data: existingUser, error } = await supabase
          .from("portal_users")
          .select("id, is_active")
          .eq("email", email)
          .single();

        if (error) {
          console.error(`Supabase error checking user: ${error.message}`);
          // If database error, allow sign-in and handle in jwt callback
          return true;
        }

        if (!existingUser) {
          console.log(`User not registered in portal: ${email}`);
          return "/login?error=NotRegistered";
        }

        if (!existingUser.is_active) {
          console.log(`Inactive user attempted login: ${email}`);
          return "/login?error=AccountInactive";
        }

        // Update last login (fire and forget)
        supabase
          .from("portal_users")
          .update({ last_login_at: new Date().toISOString() })
          .eq("email", email);

        return true;
      } catch (err) {
        console.error("SignIn callback error:", err);
        // On error, allow sign-in and handle gracefully
        return true;
      }
    },

    async jwt({ token, user, trigger }) {
      try {
        // On sign in or when session is updated, fetch user profile
        if (user?.email || trigger === "update") {
          const email = user?.email || token.email;
          if (email) {
            const supabase = getServerSupabase();
            const { data: userProfile, error } = await supabase
              .from("portal_users")
              .select(`
                id,
                role,
                department_id,
                is_active,
                portal_departments(id, name, slug)
              `)
              .eq("email", email as string)
              .single();

            if (error) {
              console.error("JWT callback - Supabase error:", error.message);
            } else if (userProfile) {
              token.userId = userProfile.id;
              token.role = userProfile.role;
              token.departmentId = userProfile.department_id;
              token.department = userProfile.portal_departments as any;
              token.isActive = userProfile.is_active;
            }
          }
        }
      } catch (err) {
        console.error("JWT callback error:", err);
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = (token.role as "employee" | "manager" | "owner") || "employee";
        session.user.departmentId = token.departmentId as string | null;
        session.user.department = token.department as any;
        session.user.isActive = token.isActive as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
