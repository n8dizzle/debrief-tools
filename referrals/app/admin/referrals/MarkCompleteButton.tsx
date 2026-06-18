"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  referralId: string;
  status: string;
  referrerName: string;
  friendName: string;
  friendEmail: string | null | undefined;
  friendPhone: string | null | undefined;
  /** ST customer ID on the referral row — enables the "Pull from ServiceTitan" path */
  stCustomerId?: string | null;
}

type CategoryValue =
  | "SERVICE_CALL"
  | "MAINTENANCE"
  | "REPLACEMENT"
  | "COMMERCIAL";

const CATEGORY_OPTIONS: { value: CategoryValue; label: string }[] = [
  { value: "SERVICE_CALL",  label: "Service Call" },
  { value: "MAINTENANCE",   label: "Maintenance" },
  { value: "REPLACEMENT",   label: "Replacement" },
  { value: "COMMERCIAL",    label: "Commercial" },
];

type Step = "idle" | "form" | "confirm" | "busy" | "done";

interface Result {
  referrerRewardAmount: number;
  referrerRewardStatus: string | null;
  referrerCharityAmount: number;
  friendRewardAmount: number | null;
  friendRewardNote: string | null;
}

interface STLookupResult {
  found: true;
  jobNumber: string | null;
  invoiceTotal: number;
  jobTypeName: string | null;
  businessUnit: string | null;
  autoCategory: CategoryValue;
  completedOn: string | null;
}

/**
 * Admin button to manually mark a referral job complete and immediately
 * issue Tremendous gift cards to both the referrer and the referred friend.
 *
 * Two paths:
 *  1. Pull from ServiceTitan — if an ST customer is linked, fetches the most
 *     recent invoice automatically and pre-fills the form.
 *  2. Enter manually — CSR types in the invoice total and service category.
 *
 * Use when the ST invoice webhook didn't fire and you need to trigger rewards
 * manually. Issues REAL gift cards — a confirmation step is required.
 */
export default function MarkCompleteButton({
  referralId,
  status,
  referrerName,
  friendName,
  friendEmail,
  friendPhone,
  stCustomerId,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [invoiceTotal, setInvoiceTotal] = useState("500");
  const [category, setCategory] = useState<CategoryValue>("SERVICE_CALL");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // ST-pull state
  const [stFetching, setStFetching] = useState(false);
  const [stError, setStError] = useState<string | null>(null);
  const [stData, setStData] = useState<STLookupResult | null>(null);

  // Only show on referrals that haven't been completed yet
  if (status !== "SUBMITTED" && status !== "BOOKED") return null;

  // ── Pull latest invoice from ServiceTitan ───────────────────────────────────
  async function pullFromST() {
    setStFetching(true);
    setStError(null);
    try {
      const res = await fetch(`/api/admin/referrals/${referralId}/st-lookup`);
      const data = await res.json();
      if (!res.ok || !data.found) {
        setStError(data.reason || data.error || "No invoice data found in ServiceTitan");
        return;
      }
      const lookup = data as STLookupResult;
      setStData(lookup);
      setInvoiceTotal(String(Math.round(lookup.invoiceTotal)));
      setCategory(lookup.autoCategory);
      setError(null);
      setStep("confirm");
    } catch {
      setStError("Network error — could not reach ServiceTitan");
    } finally {
      setStFetching(false);
    }
  }

  // ── Issue rewards ────────────────────────────────────────────────────────────
  async function run() {
    const n = Number(invoiceTotal);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Invoice total must be a positive number");
      setStep("form");
      return;
    }
    setStep("busy");
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/referrals/${referralId}/mark-complete`,
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
        setError(data.error || "Failed to mark complete");
        setStep("form");
        return;
      }
      setResult(data as Result);
      setStep("done");
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setStep("form");
    }
  }

  // ── Idle: one or two entry points depending on ST link ──────────────────────
  if (step === "idle") {
    if (stCustomerId) {
      return (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={pullFromST}
            disabled={stFetching}
            className="text-[10px] font-semibold underline"
            style={{ color: "var(--ca-green)" }}
            title="Fetch invoice from ServiceTitan and issue gift cards to referrer + friend"
          >
            {stFetching ? "Fetching from ST…" : "pull from ST & mark complete"}
          </button>
          {stError && (
            <p className="text-[10px]" style={{ color: "var(--ca-red)" }}>
              {stError}
            </p>
          )}
          <button
            type="button"
            onClick={() => { setStData(null); setStep("form"); setError(null); setResult(null); }}
            className="text-[10px] opacity-50 hover:opacity-80 underline self-start"
            style={{ color: "var(--ca-green)" }}
          >
            or enter manually
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => { setStep("form"); setError(null); setResult(null); }}
        className="text-[10px] font-semibold underline"
        style={{ color: "var(--ca-green)" }}
        title="Manually mark this job complete and issue gift cards to the referrer and friend"
      >
        mark job complete
      </button>
    );
  }

  // ── Done: confirmation summary ───────────────────────────────────────────────
  if (step === "done" && result) {
    return (
      <div
        className="flex flex-col gap-1.5 p-3 rounded-lg mt-2 text-[11px]"
        style={{
          background: "rgba(97,139,96,0.12)",
          border: "1px solid rgba(97,139,96,0.35)",
          minWidth: 220,
        }}
      >
        <p className="font-semibold" style={{ color: "var(--ca-dark-green)" }}>
          ✓ Job marked complete
        </p>
        <p>
          Referrer reward:{" "}
          <strong>${result.referrerRewardAmount}</strong>
          {result.referrerRewardStatus && (
            <span className="opacity-60"> ({result.referrerRewardStatus})</span>
          )}
        </p>
        {result.referrerCharityAmount > 0 && (
          <p>Charity match: <strong>${result.referrerCharityAmount}</strong></p>
        )}
        {result.friendRewardAmount != null ? (
          <p>
            Friend reward: <strong>${result.friendRewardAmount}</strong> sent to{" "}
            {friendEmail ?? "friend"}
          </p>
        ) : result.friendRewardNote ? (
          <p className="opacity-60">{result.friendRewardNote}</p>
        ) : null}
        <button
          type="button"
          onClick={() => setStep("idle")}
          className="text-[10px] opacity-60 hover:opacity-100 underline self-start mt-1"
        >
          close
        </button>
      </div>
    );
  }

  // ── Shared panel for form + confirm + busy ───────────────────────────────────
  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-lg mt-2"
      style={{
        background: "rgba(22,163,74,0.08)",
        border: "1px solid rgba(22,163,74,0.3)",
        minWidth: 220,
      }}
    >
      <p
        className="text-[10px] uppercase tracking-wide font-semibold"
        style={{ color: "var(--ca-dark-green)" }}
      >
        Mark Job Complete
      </p>

      {step === "confirm" ? (
        // ── Confirmation step ─────────────────────────────────────────────────
        <>
          {/* ST source badge */}
          {stData && (
            <div
              className="text-[10px] p-1.5 rounded flex items-center gap-1"
              style={{ background: "rgba(22,163,74,0.1)", color: "#166534" }}
            >
              <span>✓</span>
              <span>
                Invoice pulled from ServiceTitan
                {stData.jobNumber ? ` — Job #${stData.jobNumber}` : ""}
                {stData.jobTypeName ? ` (${stData.jobTypeName})` : ""}
              </span>
            </div>
          )}

          <div
            className="text-[11px] p-2 rounded"
            style={{ background: "rgba(220,38,38,0.08)", color: "#7f1d1d" }}
          >
            <p className="font-semibold mb-1">⚠ This sends real gift cards</p>
            <p>
              A <strong>$50 gift card</strong> will be issued to {referrerName}
              {(friendEmail || friendPhone) ? (
                <> and a <strong>$50 gift card</strong> to {friendName}{" "}
                  {friendEmail
                    ? `(${friendEmail})`
                    : `via SMS (${friendPhone})`}
                </>
              ) : ""}.
            </p>
            {!friendEmail && !friendPhone && (
              <p className="mt-1 opacity-70">
                No email or phone on file for {friendName} — friend reward will be skipped.
              </p>
            )}
            {!friendEmail && friendPhone && (
              <p className="mt-1 opacity-70">
                No email on file — gift card will be sent via SMS to {friendPhone}.
              </p>
            )}
          </div>
          {error && (
            <p
              className="text-[11px] p-1.5 rounded"
              style={{ background: "rgba(135,76,59,0.1)", color: "var(--ca-red)" }}
            >
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={run}
              className="text-xs font-semibold px-2 py-1 rounded flex-1"
              style={{ background: "var(--ca-green)", color: "var(--ca-cream)" }}
            >
              Confirm &amp; Issue
            </button>
            <button
              type="button"
              onClick={() => setStep(stData ? "idle" : "form")}
              className="text-xs opacity-70 hover:opacity-100 underline"
            >
              {stData ? "cancel" : "back"}
            </button>
          </div>
        </>
      ) : step === "busy" ? (
        // ── Loading ───────────────────────────────────────────────────────────
        <p className="text-xs opacity-60 animate-pulse">Issuing rewards…</p>
      ) : (
        // ── Manual form ──────────────────────────────────────────────────────
        <>
          <label className="block text-xs">
            <span className="block mb-1 font-semibold">Invoice total ($)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={invoiceTotal}
              onChange={(e) => setInvoiceTotal(e.target.value)}
              className="input"
              style={{ padding: "4px 8px", fontSize: "0.75rem" }}
            />
          </label>

          <label className="block text-xs">
            <span className="block mb-1 font-semibold">Service category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryValue)}
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
              style={{ background: "rgba(135,76,59,0.1)", color: "var(--ca-red)" }}
            >
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const n = Number(invoiceTotal);
                if (!Number.isFinite(n) || n <= 0) {
                  setError("Invoice total must be a positive number");
                  return;
                }
                setError(null);
                setStep("confirm");
              }}
              className="text-xs font-semibold px-2 py-1 rounded flex-1"
              style={{ background: "var(--ca-green)", color: "var(--ca-cream)" }}
            >
              Next →
            </button>
            <button
              type="button"
              onClick={() => setStep("idle")}
              className="text-xs opacity-70 hover:opacity-100 underline"
            >
              cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
