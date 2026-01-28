"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePermissions } from "@/hooks/usePermissions";

const navItems = [
  { name: "Dashboard", href: "/admin", icon: "home" },
  { name: "Users", href: "/admin/users", icon: "users" },
  { name: "Tools", href: "/admin/tools", icon: "tools", ownerOnly: true },
  { name: "Stats", href: "/admin/stats", icon: "chart" },
  { name: "Audit Log", href: "/admin/audit", icon: "clipboard", ownerOnly: true },
];

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    home: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    users: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    tools: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    chart: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    clipboard: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  };
  return icons[name] || null;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { canAccessAdmin, isOwner, isLoading } = usePermissions();

  useEffect(() => {
    if (status === "loading" || isLoading) return;

    if (!session) {
      router.push("/login");
      return;
    }

    if (!canAccessAdmin) {
      router.push("/");
      return;
    }
  }, [session, status, canAccessAdmin, isLoading, router]);

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    );
  }

  if (!session || !canAccessAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside
        className="w-64 border-r flex flex-col"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-subtle)'
        }}
      >
        {/* Logo */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <Link href="/" className="flex items-center space-x-3">
            <Image
              src="/logo.png"
              alt="Christmas Air"
              width={40}
              height={40}
              className="h-10 w-auto"
            />
            <div>
              <h1 className="text-sm font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                Admin Panel
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Internal Tools
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            // Hide owner-only items for non-owners
            if (item.ownerOnly && !isOwner) return null;

            const isActive = pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors
                  ${isActive ? "font-medium" : ""}
                `}
                style={{
                  background: isActive ? 'var(--christmas-green)' : 'transparent',
                  color: isActive ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                }}
                onMouseOver={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--bg-card-hover)';
                    e.currentTarget.style.color = 'var(--christmas-cream)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <NavIcon name={item.icon} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Back to Portal */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <Link
            href="/"
            className="flex items-center space-x-2 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Portal</span>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
