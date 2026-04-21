"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Public marketing header. On desktop (md+) it's a horizontal nav; on
 * mobile it collapses the links into a hamburger-toggled dropdown so the
 * logo stays legible at 56px rather than getting squeezed next to four
 * competing text links.
 */
export default function SiteHeader() {
  const [open, setOpen] = useState(false);

  // Close the drawer on Escape and on route-change link clicks. Also lock
  // page scroll while the menu is open so the nav feels like a modal on
  // small phones where scrolling "under" a floating menu is disorienting.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <header
      className="sticky top-0 z-20 backdrop-blur"
      style={{
        background: "rgba(245, 242, 220, 0.92)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 min-w-0"
          style={{ color: "var(--ca-dark-green)" }}
          aria-label="Christmas Air Conditioning & Plumbing — home"
        >
          <Image
            src="/logo.png"
            alt="Christmas Air Conditioning & Plumbing"
            width={300}
            height={200}
            priority
            className="h-14 md:h-16 flex-shrink-0"
            style={{ width: "auto" }}
          />
          <span className="text-xs opacity-70 hidden lg:inline">
            Neighbors Helping Neighbors
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-4 text-sm">
          <Link href="/triple-win" style={{ color: "var(--ca-dark-green)" }}>
            Triple Win
          </Link>
          <Link href="/faq" style={{ color: "var(--ca-dark-green)" }}>
            FAQ
          </Link>
          <Link href="/sign-in" style={{ color: "var(--ca-dark-green)" }}>
            Sign in
          </Link>
          <Link href="/enroll" className="btn btn-primary">
            Join the program
          </Link>
        </nav>

        {/* Mobile hamburger — a 44x44 tap target (WCAG-friendly) that toggles
            the drawer below. Animated to X when open for a clearer affordance. */}
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center rounded-lg"
          style={{
            width: 44,
            height: 44,
            color: "var(--ca-dark-green)",
            background: open ? "rgba(97,139,96,0.08)" : "transparent",
          }}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="site-mobile-menu"
        >
          <HamburgerIcon open={open} />
        </button>
      </div>

      {/* Mobile drawer: absolutely-positioned full-width dropdown directly
          below the header. Uses the backdrop-blur pattern of the header for
          visual continuity. Only renders on mobile (md:hidden on wrapper). */}
      {open && (
        <div
          id="site-mobile-menu"
          className="md:hidden"
          style={{
            borderTop: "1px solid var(--border-subtle)",
            background: "rgba(245, 242, 220, 0.98)",
          }}
        >
          <nav className="px-4 py-3 flex flex-col gap-1 text-base">
            <MobileLink href="/triple-win" onClick={() => setOpen(false)}>
              Triple Win
            </MobileLink>
            <MobileLink href="/faq" onClick={() => setOpen(false)}>
              FAQ
            </MobileLink>
            <MobileLink href="/sign-in" onClick={() => setOpen(false)}>
              Sign in
            </MobileLink>
            <Link
              href="/enroll"
              onClick={() => setOpen(false)}
              className="btn btn-primary mt-2 text-center"
            >
              Join the program
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  // Three-line burger that morphs into an X. Using stroke lines with
  // CSS transforms keeps the markup simple and the animation cheap.
  const common = "block h-0.5 w-6 transition-transform duration-150 ease-out";
  const bg = "currentColor";
  return (
    <span className="relative inline-block w-6 h-6" aria-hidden="true">
      <span
        className={common}
        style={{
          position: "absolute",
          top: open ? "50%" : "30%",
          left: 0,
          background: bg,
          transform: open ? "translateY(-50%) rotate(45deg)" : "translateY(-50%)",
        }}
      />
      <span
        className={common}
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          background: bg,
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
          background: bg,
          transform: open ? "translateY(-50%) rotate(-45deg)" : "translateY(-50%)",
        }}
      />
    </span>
  );
}

function MobileLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-3 py-3 rounded-lg"
      style={{
        color: "var(--ca-dark-green)",
        minHeight: 44,
      }}
    >
      {children}
    </Link>
  );
}
