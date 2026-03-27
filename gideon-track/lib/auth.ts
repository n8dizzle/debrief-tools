import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getServerSupabase } from "./supabase";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const supabase = getServerSupabase();
        const { data: user, error } = await supabase
          .from("gt_users")
          .select("*")
          .eq("email", credentials.email.toLowerCase().trim())
          .eq("is_active", true)
          .single();

        if (error || !user || !user.password_hash) return null;

        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.active_role,
          roles: user.roles,
          isActive: user.is_active,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Credentials provider already validated
      if (account?.provider === "credentials") return true;

      // Google OAuth - check user exists with admin or tutor role
      if (account?.provider === "google" && user.email) {
        const supabase = getServerSupabase();
        const { data: dbUser } = await supabase
          .from("gt_users")
          .select("id, roles, is_active")
          .eq("email", user.email.toLowerCase())
          .eq("is_active", true)
          .single();

        if (!dbUser || (!dbUser.roles.includes("admin") && !dbUser.roles.includes("tutor"))) {
          return "/login?error=AccessDenied";
        }

        return true;
      }

      return false;
    },
    async jwt({ token, user, account, trigger }) {
      // On initial sign-in or session update, fetch user from DB
      if ((user && account) || trigger === "update") {
        const supabase = getServerSupabase();
        const email = token.email || user?.email;
        if (email) {
          const { data: dbUser } = await supabase
            .from("gt_users")
            .select("id, roles, active_role, is_active")
            .eq("email", email.toLowerCase())
            .single();

          if (dbUser) {
            token.userId = dbUser.id;
            token.role = dbUser.active_role;
            token.roles = dbUser.roles;
            token.isActive = dbUser.is_active;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = token.role as "admin" | "tutor" | "parent";
        session.user.roles = (token.roles || [token.role]) as ("admin" | "tutor" | "parent")[];
        session.user.isActive = token.isActive as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
