"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  referrerId: string;
  name: string;
}

export default function DeleteReferrerButton({ referrerId, name }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/referrers/${referrerId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Delete failed");
        setConfirming(false);
      }
    } catch {
      alert("Network error");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          onClick={handleDelete}
          disabled={busy}
          className="text-xs font-semibold px-2 py-1 rounded"
          style={{ background: "var(--ca-red)", color: "#fff", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Removing…" : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="text-xs px-2 py-1 rounded opacity-60"
          style={{ background: "var(--bg-muted)" }}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={`Remove ${name}`}
      className="text-xs opacity-40 hover:opacity-80 transition-opacity px-1"
      style={{ color: "var(--ca-red)" }}
    >
      Remove
    </button>
  );
}
