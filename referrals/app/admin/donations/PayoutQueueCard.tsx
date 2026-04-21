"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface PayoutSummary {
  charityId: string;
  charityName: string;
  fulfillmentMethod: string | null;
  count: number;
  total: number;
  oldestDays: number;
}

export default function PayoutQueueCard({ summary }: { summary: PayoutSummary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reference.trim()) {
      setError("Reference (check number, batch ID, etc.) is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Convert YYYY-MM-DD to an ISO datetime at midnight local. Server
      // accepts any ISO 8601 string.
      const iso = new Date(`${paidAt}T12:00:00`).toISOString();
      const res = await fetch("/api/admin/donations/mark-paid-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          charityId: summary.charityId,
          paidAt: iso,
          reference: reference.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        setBusy(false);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  const ageBadge =
    summary.oldestDays >= 60
      ? { bg: "rgba(135,76,59,0.12)", fg: "var(--ca-red)" }
      : summary.oldestDays >= 30
      ? { bg: "rgba(166,153,78,0.2)", fg: "#7a6e2c" }
      : { bg: "rgba(97,139,96,0.12)", fg: "var(--ca-dark-green)" };

  return (
    <div
      className="card"
      style={{
        border: "1px solid var(--border-subtle)",
        minWidth: "240px",
      }}
    >
      <p
        className="text-sm uppercase tracking-wide opacity-60 mb-1"
      >
        {(summary.fulfillmentMethod || "manual").toLowerCase().replace(/_/g, " ")}
      </p>
      <p className="text-lg font-semibold mb-1" style={{ color: "var(--ca-dark-green)" }}>
        {summary.charityName}
      </p>
      <p
        className="text-3xl mb-2"
        style={{
          fontFamily: "var(--font-lobster)",
          color: "var(--ca-dark-green)",
        }}
      >
        ${Math.round(summary.total)}
      </p>
      <div className="flex items-center gap-2 text-xs mb-4">
        <span>
          {summary.count} donation{summary.count === 1 ? "" : "s"}
        </span>
        <span
          className="px-2 py-0.5 rounded-full"
          style={{ background: ageBadge.bg, color: ageBadge.fg }}
        >
          oldest {summary.oldestDays}d
        </span>
      </div>

      {!open ? (
        <button
          className="btn btn-primary w-full"
          onClick={() => setOpen(true)}
        >
          Mark {summary.count} paid
        </button>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="block text-xs font-semibold mb-1.5 opacity-80">
              Payout date
            </span>
            <input
              className="input"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold mb-1.5 opacity-80">
              Reference (check #, batch ID)
            </span>
            <input
              className="input"
              placeholder="e.g. Check #1042"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={busy}
            />
          </label>
          {error && (
            <p
              className="text-xs p-2 rounded"
              style={{
                background: "rgba(135,76,59,0.1)",
                color: "var(--ca-red)",
              }}
            >
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              className="btn btn-secondary flex-1"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary flex-1"
              onClick={submit}
              disabled={busy}
              style={{ opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "Saving…" : "Confirm"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
