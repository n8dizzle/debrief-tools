"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/share", label: "Share" },
  { href: "/dashboard/charity", label: "Your charity" },
];

export default function DashboardHeader({ firstName }: { firstName: string }) {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-10 backdrop-blur"
      style={{
        background: "rgba(245, 242, 220, 0.92)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div className="max-w-5xl mx-auto px-6 pt-4 pb-0 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-3"
          style={{ color: "var(--ca-dark-green)" }}
          aria-label="Christmas Air — Dashboard home"
        >
          <Image
            src="/logo.png"
            alt="Christmas Air Conditioning & Plumbing"
            width={300}
            height={200}
            priority
            className="h-12 md:h-14"
            style={{ width: "auto" }}
          />
          <span className="text-xs opacity-70 hidden sm:inline">Dashboard</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="opacity-80 hidden sm:inline">Hi, {firstName}</span>
          <form action="/api/auth/customer/logout" method="post">
            <button type="submit" className="opacity-70 hover:opacity-100">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <nav className="max-w-5xl mx-auto px-6 mt-3 flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const active =
            t.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className="px-4 py-2 text-sm whitespace-nowrap"
              style={{
                color: active ? "var(--ca-dark-green)" : "var(--text-muted)",
                fontWeight: active ? 600 : 400,
                borderBottom: `2px solid ${active ? "var(--ca-green)" : "transparent"}`,
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
