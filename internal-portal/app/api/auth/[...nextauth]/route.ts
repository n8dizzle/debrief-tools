import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Allowed email domains - add your company domain(s)
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || "christmasac.com").split(",");

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Check if user's email domain is allowed
      const email = user.email || "";
      const domain = email.split("@")[1];
      
      if (ALLOWED_DOMAINS.includes(domain)) {
        return true;
      }
      
      // Reject sign-in for non-allowed domains
      console.log(`Rejected sign-in attempt from: ${email}`);
      return false;
    },
    async session({ session, token }) {
      // Add user info to session
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login", // Redirect errors to login page
  },
});

export { handler as GET, handler as POST };
