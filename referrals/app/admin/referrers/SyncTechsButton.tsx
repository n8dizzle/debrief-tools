"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SyncResult {
  total_technicians: number;
  total_employees: number;
  total_unique: number;
  created: number;
  skipped_existing: number;
  skipped_no_email: number;
  skipped_bad_email: number;
  errors: string[];
}

interface AutoLinkResult {
  total_checked: number;
  linked: number;
  skipped_no_match: number;
  errors: string[];
}

export default function SyncTechsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [linkResult, setLinkResult] = useState<AutoLinkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/referrers/sync-technicians", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sync failed.");
      } else {
        setResult(data);
        router.refresh();
      }
    } catch {
      setError("Network error — sync failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoLink() {
    setLinking(true);
    setLinkResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/referrers/auto-link", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Auto-link failed.");
      } else {
        setLinkResult(data);
        router.refresh();
      }
    } catch {
      setError("Network error — auto-link failed.");
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 items-end">
      <div className="flex gap-2">
        <button
          onClick={handleAutoLink}
          disabled={linking || loading}
          className="btn"
          style={{
            opacity: linking || loading ? 0.7 : 1,
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
          }}
        >
          {linking ? "Linking…" : "Auto-link ST Customers"}
        </button>
        <button
          onClick={handleSync}
          disabled={loading || linking}
          className="btn btn-primary"
          style={{ opacity: loading || linking ? 0.7 : 1 }}
        >
          {loading ? "Syncing…" : "Sync Staff from ST"}
        </button>
      </div>

      {result && (
        <div
          className="text-sm rounded-lg px-4 py-3 text-right"
          style={{ background: "var(--bg-muted)", minWidth: 280 }}
        >
          <p className="font-semibold mb-1">
            ✅ {result.created} account{result.created !== 1 ? "s" : ""} created
          </p>
          <p className="opacity-70">
            {result.total_technicians} techs · {result.total_employees} employees · {result.total_unique} unique
          </p>
          <p className="opacity-70">
            {result.skipped_existing} already enrolled
            {result.skipped_no_email > 0 ? ` · ${result.skipped_no_email} no email` : ""}
            {result.skipped_bad_email > 0 ? ` · ${result.skipped_bad_email} filtered` : ""}
          </p>
          {result.errors.length > 0 && (
            <p className="mt-2 text-xs opacity-60">
              {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}:{" "}
              {result.errors.slice(0, 3).join("; ")}
            </p>
          )}
        </div>
      )}

      {linkResult && (
        <div
          className="text-sm rounded-lg px-4 py-3 text-right"
          style={{ background: "var(--bg-muted)", minWidth: 280 }}
        >
          <p className="font-semibold mb-1">
            🔗 {linkResult.linked} customer{linkResult.linked !== 1 ? "s" : ""} linked to ST
          </p>
          <p className="opacity-70">
            {linkResult.total_checked} checked · {linkResult.skipped_no_match} no match in ST
          </p>
          {linkResult.errors.length > 0 && (
            <p className="mt-2 text-xs opacity-60">
              {linkResult.errors.length} error{linkResult.errors.length !== 1 ? "s" : ""}:{" "}
              {linkResult.errors.slice(0, 3).join("; ")}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm" style={{ color: "var(--ca-red, #c0392b)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
