"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DonationActions({ donationId }: { donationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (!confirm("Approve this donation and trigger fulfillment?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/donations/${donationId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Approve failed");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  async function deny() {
    const reason = prompt("Reason for denying this donation:");
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/donations/${donationId}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Deny failed");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <button
          onClick={approve}
          disabled={busy}
          className="px-3 py-1 rounded text-xs font-semibold"
          style={{
            background: "var(--ca-green)",
            color: "var(--ca-cream)",
            opacity: busy ? 0.5 : 1,
          }}
        >
          Approve
        </button>
        <button
          onClick={deny}
          disabled={busy}
          className="px-3 py-1 rounded text-xs font-semibold"
          style={{
            background: "var(--ca-red)",
            color: "var(--ca-cream)",
            opacity: busy ? 0.5 : 1,
          }}
        >
          Deny
        </button>
      </div>
      {error && (
        <span className="text-xs" style={{ color: "var(--ca-red)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
