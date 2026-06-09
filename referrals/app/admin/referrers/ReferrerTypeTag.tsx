"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReferrerType = "EMPLOYEE" | "CUSTOMER" | null;

interface Props {
  referrerId: string;
  initialType: ReferrerType;
}

const STYLES: Record<string, { bg: string; fg: string }> = {
  EMPLOYEE: { bg: "rgba(59,130,246,0.15)", fg: "#1e40af" },
  CUSTOMER: { bg: "rgba(97,139,96,0.15)", fg: "#415440" },
};

export default function ReferrerTypeTag({ referrerId, initialType }: Props) {
  const router = useRouter();
  const [type, setType] = useState<ReferrerType>(initialType);
  const [busy, setBusy] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newType = (e.target.value || null) as ReferrerType;
    setType(newType);
    setBusy(true);
    try {
      await fetch(`/api/admin/referrers/${referrerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referrer_type: newType }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const style = type ? STYLES[type] : null;

  return (
    <select
      value={type ?? ""}
      onChange={handleChange}
      disabled={busy}
      className="text-xs font-semibold rounded-full px-2 py-0.5 border-0 cursor-pointer"
      style={{
        background: style ? style.bg : "var(--bg-muted)",
        color: style ? style.fg : "var(--text-muted)",
        opacity: busy ? 0.5 : 1,
        outline: "1px solid var(--border-subtle)",
      }}
    >
      <option value="">Tag…</option>
      <option value="EMPLOYEE">Employee</option>
      <option value="CUSTOMER">Customer</option>
    </select>
  );
}
