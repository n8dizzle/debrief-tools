import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Guard for /api/admin/* route handlers. Middleware only gates /admin PAGES, so API
// routes must check the session themselves. Returns the session email or null.
export async function requireManager(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;
  const domain = email.split("@")[1];
  const allowed = (process.env.ALLOWED_EMAIL_DOMAINS || "christmasair.com").split(",");
  if (!allowed.includes(domain)) return null;
  return email;
}
