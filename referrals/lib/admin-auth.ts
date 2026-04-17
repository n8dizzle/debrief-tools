import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface AdminContext {
  userId: string;
  email: string;
  role: "owner" | "manager" | "employee";
  permissions: Record<string, Record<string, boolean>> | null;
}

/**
 * Check whether the current session can perform an admin action against the
 * referrals app. Owners always pass. Other roles must have the named
 * permission under `referrals` in their portal_users.permissions JSONB.
 *
 * Returns the admin context on success, null on rejection.
 */
export async function requireReferralsAdmin(
  permission: string
): Promise<AdminContext | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  if (!session.user.isActive) return null;

  const role = session.user.role;
  const permissions = session.user.permissions || null;

  // Owners always pass — they're the four founders per CLAUDE.md
  if (role === "owner") {
    return {
      userId: session.user.id,
      email: session.user.email,
      role,
      permissions,
    };
  }

  const referralsPerms = permissions?.referrals;
  if (referralsPerms?.[permission]) {
    return {
      userId: session.user.id,
      email: session.user.email,
      role,
      permissions,
    };
  }

  return null;
}
