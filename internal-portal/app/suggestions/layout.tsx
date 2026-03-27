"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import ProfileDropdown from "@/components/ProfileDropdown";
import { usePermissions } from "@/hooks/usePermissions";

export default function SuggestionsLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { canAccessAdmin } = usePermissions();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) router.push("/login");
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center space-x-3">
                <Image
                  src="/logo.png"
                  alt="Christmas Air"
                  width={48}
                  height={48}
                  className="h-12 w-auto"
                />
                <div>
                  <h1 className="text-lg font-semibold" style={{ color: "var(--christmas-cream)" }}>
                    Idea Board
                  </h1>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Christmas Air Internal Tools
                  </p>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-sm px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                Back to Portal
              </Link>
              {session.user && (
                <ProfileDropdown
                  userName={session.user.name}
                  userEmail={session.user.email}
                  canAccessAdmin={canAccessAdmin}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
