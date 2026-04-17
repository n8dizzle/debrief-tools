import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";

function hasAdminAccess(
  role: string | undefined,
  permissions: Record<string, Record<string, boolean>> | null | undefined
): boolean {
  if (role === "owner") return true;
  return Boolean(permissions?.referrals?.can_view_admin);
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  if (!hasAdminAccess(session.user.role, session.user.permissions)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="card max-w-md text-center">
          <h1 className="text-3xl mb-3">No access</h1>
          <p className="opacity-80 mb-4">
            You&apos;re signed in as <strong>{session.user.email}</strong>, but your
            account doesn&apos;t have permission to manage the referral program.
          </p>
          <p className="text-sm opacity-60">
            Ask an owner to grant you <code>referrals.can_view_admin</code> in
            the Internal Portal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen grid"
      style={{ gridTemplateColumns: "minmax(0, 240px) minmax(0, 1fr)" }}
    >
      <AdminNav userEmail={session.user.email} />
      <main className="p-8 overflow-x-auto" style={{ background: "var(--ca-cream)" }}>
        {children}
      </main>
    </div>
  );
}
