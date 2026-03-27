"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const adminLinks: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "home" },
  { href: "/admin/sessions/new", label: "Log Session", icon: "plus" },
  { href: "/admin/students", label: "Students", icon: "users" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/curriculum", label: "Curriculum", icon: "book" },
];

const tutorLinks: NavItem[] = [
  { href: "/tutor", label: "Dashboard", icon: "home" },
  { href: "/tutor/sessions/new", label: "Log Session", icon: "plus" },
];

const roleLabels: Record<string, string> = {
  admin: "Admin",
  tutor: "Tutor",
  parent: "Parent",
};

function NavIcon({ type, active }: { type: string; active?: boolean }) {
  const color = active ? "white" : "currentColor";
  const icons: Record<string, JSX.Element> = {
    home: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    users: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    briefcase: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
    heart: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    book: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    plus: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  };
  return icons[type] || null;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, update } = useSession();
  const role = session?.user?.role;
  const roles = session?.user?.roles || [];
  const [switching, setSwitching] = useState(false);

  const links = role === "admin" ? adminLinks : tutorLinks;

  const isActive = (href: string) => {
    if (href === "/admin" || href === "/tutor") return pathname === href;
    return pathname.startsWith(href);
  };

  async function switchRole(newRole: string) {
    if (newRole === role || switching) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/users/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        await update(); // Refresh the NextAuth session (triggers jwt callback re-fetch)
        router.push("/"); // Root page redirects based on active_role
      }
    } finally {
      setSwitching(false);
    }
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen w-64 z-50 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: 'var(--sidebar-bg)' }}
      >
        {/* Header */}
        <div className="p-5 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--gideon-red) 0%, var(--gideon-orange) 100%)',
                boxShadow: '0 2px 8px rgba(217, 48, 37, 0.3)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <div>
              <h1
                className="text-lg leading-tight"
                style={{
                  color: 'white',
                  fontFamily: 'var(--font-display), sans-serif',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                }}
              >
                GideonTrack
              </h1>
              <p className="text-xs capitalize" style={{ color: 'var(--sidebar-text)', opacity: 0.6 }}>
                {role} Panel
              </p>
            </div>
          </div>
        </div>

        {/* Role Switcher */}
        {roles.length > 1 && (
          <div className="mx-4 mb-2">
            <div
              className="flex rounded-lg p-0.5 gap-0.5"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              {roles.map((r) => (
                <button
                  key={r}
                  onClick={() => switchRole(r)}
                  disabled={switching}
                  className="flex-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-all duration-150"
                  style={{
                    background: r === role ? 'var(--gideon-blue)' : 'transparent',
                    color: r === role ? 'white' : 'var(--sidebar-text)',
                    opacity: r === role ? 1 : 0.6,
                    cursor: switching ? 'wait' : 'pointer',
                  }}
                >
                  {roleLabels[r] || r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="mx-4 mb-2" style={{ height: '1px', background: 'linear-gradient(90deg, var(--gideon-blue) 0%, transparent 100%)', opacity: 0.3 }} />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2" style={{ color: 'var(--sidebar-text)', opacity: 0.4 }}>
            Navigation
          </p>
          <div className="space-y-0.5">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
                  style={{
                    background: active ? 'var(--gideon-blue)' : 'transparent',
                    color: active ? 'white' : 'var(--sidebar-text)',
                    boxShadow: active ? '0 2px 8px rgba(41, 182, 214, 0.3)' : 'none',
                  }}
                >
                  <NavIcon type={link.icon} active={active} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'var(--gideon-blue)', color: 'white' }}
            >
              {session?.user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{session?.user?.name}</p>
              <p className="text-[11px] truncate" style={{ color: 'var(--sidebar-text)', opacity: 0.5 }}>
                {session?.user?.email}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-2 rounded-lg transition-colors shrink-0"
              style={{ color: 'var(--sidebar-text)' }}
              title="Sign out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1-2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
