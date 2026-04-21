"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import AdminNav from "./AdminNav";

/**
 * Responsive chrome for the admin area.
 *
 * Desktop (md+): classic two-column grid — 240px sticky sidebar + main.
 * Mobile (< md): sidebar is hidden off-canvas by default, slides in as a
 * drawer when the hamburger in the mobile top bar is tapped. Main content
 * is full-width with a top bar reserving space.
 *
 * Route changes close the drawer (pathname effect). Body scroll locks while
 * the drawer is open on mobile so the overlay feels modal.
 */
export default function AdminShell({
  userEmail,
  children,
}: {
  userEmail: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="min-h-screen">
      {/* Mobile top bar — hidden on md+ */}
      <header
        className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{
          background: "var(--ca-dark-green)",
          color: "var(--ca-cream)",
          borderBottom: "1px solid rgba(245,242,220,0.15)",
        }}
      >
        <Link
          href="/admin"
          className="flex items-center gap-2"
          onClick={() => setOpen(false)}
          style={{ color: "var(--ca-cream)" }}
          aria-label="Christmas Air — Referrals admin home"
        >
          <Image
            src="/logo.png"
            alt=""
            width={300}
            height={200}
            priority
            className="h-9"
            style={{
              width: "auto",
              // The full-color shield reads as a cream-backed badge on the
              // dark-green bar. Adding slight brightness helps it pop.
              filter: "brightness(1.02)",
            }}
          />
          <span className="text-sm opacity-80">Referrals admin</span>
        </Link>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg"
          style={{
            width: 44,
            height: 44,
            color: "var(--ca-cream)",
            background: open ? "rgba(245,242,220,0.12)" : "transparent",
          }}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="admin-drawer"
        >
          <HamburgerIcon open={open} />
        </button>
      </header>

      {/* Mobile overlay scrim — tap outside the drawer to close */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-30"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className="md:grid"
        style={{
          // Desktop two-column; mobile stacks (single flow) because md:grid
          // activates only at ≥768px.
          gridTemplateColumns: "minmax(0, 240px) minmax(0, 1fr)",
          minHeight: "calc(100vh - 0px)",
        }}
      >
        <aside
          id="admin-drawer"
          // Mobile: fixed off-canvas, slides in based on `open`. Desktop:
          // participates in grid flow, always visible, grid cell controls
          // width. Using Tailwind class toggles (not inline style) so
          // md:translate-x-0 and md:w-auto actually win at breakpoint —
          // inline styles have higher CSS specificity than classes and
          // was silently keeping the sidebar off-screen on desktop.
          className={[
            "fixed inset-y-0 left-0 z-40 w-64",
            "transition-transform duration-200 ease-out",
            "md:relative md:translate-x-0 md:w-auto",
            open ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <AdminNav
            userEmail={userEmail}
            onNavigate={() => setOpen(false)}
          />
        </aside>

        <main
          className="p-4 md:p-8 overflow-x-auto"
          style={{ background: "var(--ca-cream)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  const common = "block h-0.5 w-6 transition-transform duration-150 ease-out";
  return (
    <span className="relative inline-block w-6 h-6" aria-hidden="true">
      <span
        className={common}
        style={{
          position: "absolute",
          top: open ? "50%" : "30%",
          left: 0,
          background: "currentColor",
          transform: open ? "translateY(-50%) rotate(45deg)" : "translateY(-50%)",
        }}
      />
      <span
        className={common}
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          background: "currentColor",
          transform: "translateY(-50%)",
          opacity: open ? 0 : 1,
          transition: "opacity 150ms",
        }}
      />
      <span
        className={common}
        style={{
          position: "absolute",
          top: open ? "50%" : "70%",
          left: 0,
          background: "currentColor",
          transform: open ? "translateY(-50%) rotate(-45deg)" : "translateY(-50%)",
        }}
      />
    </span>
  );
}
