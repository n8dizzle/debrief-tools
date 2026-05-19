"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReferrerType = "EMPLOYEE" | "CUSTOMER" | null;

interface Props {
  referrerId: string;
  initialType: ReferrerType;
}

const TAG_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  EMPLOYEE: { bg: "rgba(59,130,246,0.15)", fg: "#1e40af", label: "Employee" },
  CUSTOMER: { bg: "rgba(97,139,96,0.15)", fg: "#415440", label: "Customer" },
};

export default function ReferrerTypeTag({ referrerId, initialType }: Props) {
  const router = useRouter();
  const [type, setType] = useState<ReferrerType>(initialType);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function update(newType: ReferrerType) {
    setBusy(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/admin/referrers/${referrerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referrer_type: newType }),
      });
      if (res.ok) {
        setType(newType);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const style = type ? TAG_STYLES[type] : null;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-opacity"
        style={
          style
            ? { background: style.bg, color: style.fg }
            : { background: "var(--bg-muted)", color: "var(--text-muted)", border: "1px dashed var(--border-subtle)" }
        }
        title="Click to change tag"
      >
        {style ? style.label : "Tag…"}
        <span style={{ opacity: 0.5 }}>▾</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 rounded-lg shadow-lg overflow-hidden text-xs"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", minWidth: "110px" }}
        >
          {(["EMPLOYEE", "CUSTOMER"] as const).map((t) => (
            <button
              key={t}
              onClick={() => update(t)}
              className="w-full text-left px-3 py-2 hover:opacity-80 flex items-center gap-2"
              style={{ background: type === t ? TAG_STYLES[t].bg : undefined }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: TAG_STYLES[t].fg }}
              />
              {TAG_STYLES[t].label}
            </button>
          ))}
          {type && (
            <button
              onClick={() => update(null)}
              className="w-full text-left px-3 py-2 hover:opacity-80 opacity-50"
            >
              Remove tag
            </button>
          )}
        </div>
      )}
    </div>
  );
}
