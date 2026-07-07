import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getServerSupabase } from "@/lib/supabase";

const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || "christmasair.com").split(",");

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
        const email = (user.email || "").toLowerCase();
        const domain = email.split("@")[1];
        if (!ALLOWED_DOMAINS.includes(domain)) {
          return false;
        }
        const supabase = getServerSupabase();
        const { data: existingUser, error } = await supabase
          .from("portal_users")
          .select("id, is_active")
          .eq("email", email)
          .single();
        if (error) return true; // DB hiccup: allow, resolve in jwt callback
        if (!existingUser) return "/login?error=NotRegistered";
        if (!existingUser.is_active) return "/login?error=AccountInactive";
        supabase
          .from("portal_users")
          .update({ last_login_at: new Date().toISOString() })
          .eq("email", email);
        return true;
      } catch {
        return true;
      }
    },
    async jwt({ token, user, trigger }) {
      try {
        if (user?.email || trigger === "update") {
          const email = (user?.email || (token.email as string))?.toLowerCase();
          if (email) {
            const supabase = getServerSupabase();
            const { data: profile, error } = await supabase
              .from("portal_users")
              .select("id, role, department_id, is_active, permissions")
              .eq("email", email)
              .single();
            if (!error && profile) {
              token.userId = profile.id;
              token.role = profile.role;
              token.departmentId = profile.department_id;
              token.isActive = profile.is_active;
              token.permissions = profile.permissions;
            }
          }
        }
      } catch {
        /* non-fatal */
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = (token.role as "employee" | "manager" | "owner") || "employee";
        session.user.departmentId = token.departmentId as string | null;
        session.user.isActive = token.isActive as boolean;
        session.user.permissions = token.permissions as Record<string, Record<string, boolean>> | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
