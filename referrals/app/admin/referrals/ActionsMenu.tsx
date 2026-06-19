"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  children: React.ReactNode;
}

/**
 * Compact "⋯" actions trigger for a table row. Opens a popover rendered into
 * a portal with position: fixed so it is NOT clipped by the table's
 * overflow-x/y scroll container. Closes on outside click, Escape, or
 * scroll/resize (since the fixed position is computed once on open).
 *
 * Children are the row's action controls (tag in ST, mark complete, etc.).
 * Each child self-hides when not applicable, so the menu shows only the
 * actions that make sense for that row.
 */
export default function ActionsMenu({ children }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const MENU_WIDTH = 280;

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
    function onScrollOrResize() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const left = Math.max(8, r.right - MENU_WIDTH);
      setPos({ top: r.bottom + 4, left });
    }
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
