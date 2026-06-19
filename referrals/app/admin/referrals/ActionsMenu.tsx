"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface Props {
  children: React.ReactNode;
}

/**
 * Compact "⋯" actions trigger for a table row. Opens a popover rendered into
 * a portal with position: fixed so it is NOT clipped by the table's
 * overflow-x/y scroll container.
 *
 * - Closes on outside click or Escape.
 * - Repositions (rather than closing) when the page/table scrolls or the
 *   window resizes, so it stays attached to its trigger.
 * - Scrolls that originate inside the menu itself are ignored, so a tall menu
 *   can scroll its own contents without dismissing.
 */
export default function ActionsMenu({ children }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const MENU_WIDTH = 280;

  const reposition = useCallback(() => {
    const el = btnRef.current;
    if (!el) {
      setOpen(false);
      return;
    }
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: Math.max(8, r.right - MENU_WIDTH) });
  }, []);

  useEffect(() => {
    if (!open) return;

    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScroll(e: Event) {
      // Ignore scrolling inside the menu's own scroll area.
      if (menuRef.current?.contains(e.target as Node)) return;
      reposition();
    }
    function onResize() {
      reposition();
    }

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, reposition]);

  function toggle() {
    if (!open) reposition();
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Actions"
        className="px-2 py-1 rounded text-base leading-none font-bold"
        style={{
          color: "var(--text-muted)",
          background: open ? "var(--bg-muted)" : "transparent",
          border: "1px solid var(--border-subtle)",
          cursor: "pointer",
        }}
      >
        ⋯
      </button>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="flex flex-col gap-2"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: MENU_WIDTH,
              maxHeight: "60vh",
              overflowY: "auto",
              zIndex: 60,
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              padding: 12,
            }}
          >
            {children}
          </div>,
          document.body
        )}
    </>
  );
}
