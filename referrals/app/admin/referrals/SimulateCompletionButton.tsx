"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  referralId: string;
  status: string;
}

type CategoryValue =
  | "SERVICE_CALL"
  | "MAINTENANCE"
  | "REPLACEMENT"
  | "COMMERCIAL";

const CATEGORY_OPTIONS: { value: CategoryValue; label: string }[] = [
  { value: "SERVICE_CALL", label: "Service Call" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "REPLACEMENT", label: "Replacement" },
  { value: "COMMERCIAL", label: "Commercial" },
];

/**
 * Admin testing tool that fakes a paid-invoice conversion so we can verify
 * the reward → Tremendous pipeline without needing an actual ST invoice
 * event. Only works in sandbox mode (backend enforces).
 *
 * Shown only on SUBMITTED / BOOKED referrals — already-completed ones
 * would no-op on the server anyway.
 */
export default function SimulateCompletionButton({
  referralId,
  status,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [invoiceTotal, setInvoiceTotal] = useState("500");
  const [category, setCategory] = useState<CategoryValue>("SERVICE_CALL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    rewardAmount: number;
    charityAmount: number;
    rewardStatus: string | null;
  } | null>(null);

  if (status !== "SUBMITTED" && status !== "BOOKED") return null;

  async function run() {
    const n = Number(invoiceTotal);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Invoice total must be a positive number");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/referrals/${referralId}/simulate-completion`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceTotal: n,
            actualCategory: category,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Simulation failed");
        setBusy(false);
        return;
      }
      setResult({
        rewardAmount: data.rewardAmount,
        charityAmount: data.charityAmount,
        rewardStatus: data.rewardStatus,
      });
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setResult(null);
          setError(null);
        }}
        className="text-[10px] font-semibold underline opacity-70 hover:opacity-100"
        style={{ color: "var(--ca-dark-green)" }}
        title="Test the reward pipeline without waiting on a real ST invoice event. Sandbox only."
      >
        simulate paid
      </button>
    );
  }

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-lg mt-2"
      style={{
        background: "rgba(166,153,78,0.12)",
        border: "1px solid rgba(166,153,78,0.4)",
        minWidth: 220,
      }}
    >
      <p className="text-[10px] uppercase tracking-wide font-semibold opacity-70">
        Simulate paid invoice (sandbox)
      </p>

      <label className="block text-xs">
        <span className="block mb-1 font-semibold">Invoice total ($)</span>
        <input
          type="number"
          min={1}
          step={1}
          value={invoiceTotal}
          onChange={(e) => setInvoiceTotal(e.target.value)}
          disabled={busy}
          className="input"
          style={{ padding: "4px 8px", fontSize: "0.75rem" }}
        />
      </label>

      <label className="block text-xs">
        <span className="block mb-1 font-semibold">Actual category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryValue)}
          disabled={busy}
          className="select"
          style={{ padding: "4px 8px", fontSize: "0.75rem" }}
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p
          className="text-[11px] p-1.5 rounded"
          style={{
            background: "rgba(135,76,59,0.1)",
            color: "var(--ca-red)",
          }}
        >
          {error}
        </p>
      )}

      {result && (
        <div
          className="text-[11px] p-1.5 rounded"
          style={{
            background: "rgba(97,139,96,0.12)",
            color: "var(--ca-dark-green)",
          }}
        >
          <p>
            ✓ Reward <strong>${result.rewardAmount}</strong>
            {result.rewardStatus && (
              <span className="opacity-70"> ({result.rewardStatus})</span>
            )}
          </p>
          {result.charityAmount > 0 && (
            <p>
              Charity <strong>${result.charityAmount}</strong>
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="text-xs font-semibold px-2 py-1 rounded flex-1"
          style={{
            background: "var(--ca-green)",
            color: "var(--ca-cream)",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Running…" : "Run"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="text-xs opacity-70 hover:opacity-100 underline"
        >
          close
        </button>
      </div>
    </div>
  );
}
