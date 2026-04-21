"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/referrers", label: "Referrers" },
  { href: "/admin/referrals", label: "Referrals" },
  { href: "/admin/rewards", label: "Rewards" },
  { href: "/admin/donations", label: "Donations" },
  { href: "/admin/charities", label: "Charities" },
  { href: "/admin/config", label: "Reward configs" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/tremendous", label: "Tremendous" },
  { href: "/admin/help", label: "Help" },
];

export default function AdminNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col p-6"
      style={{
        background: "var(--ca-dark-green)",
        color: "var(--ca-cream)",
        minHeight: "100vh",
      }}
    >
      <div className="mb-10">
        <p
          className="text-2xl"
          style={{
            fontFamily: "var(--font-lobster)",
            color: "var(--ca-cream)",
          }}
        >
          Christmas Air
        </p>
        <p className="text-xs opacity-70 mt-1">Referrals admin</p>
      </div>

      <nav className="flex-1 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: active ? "rgba(245,242,220,0.15)" : "transparent",
                color: "var(--ca-cream)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        className="mt-8 pt-6 text-xs"
        style={{ borderTop: "1px solid rgba(245,242,220,0.15)" }}
      >
        <p className="opacity-80 mb-3 break-all">{userEmail}</p>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="opacity-70 hover:opacity-100"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
