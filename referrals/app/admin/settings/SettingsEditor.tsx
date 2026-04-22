"use client";

import { useState } from "react";
import type { Setting } from "@/lib/settings";

export interface TripleWinCounts {
  withCharity: number;
  withoutCharity: number;
  eligibleForAnnouncement: number;
}

export default function SettingsEditor({
  initial,
  tripleWinCounts,
}: {
  initial: Setting[];
  tripleWinCounts: TripleWinCounts;
}) {
  const [rows, setRows] = useState<Setting[]>(initial);
  const [eligible, setEligible] = useState(
    tripleWinCounts.eligibleForAnnouncement
  );

  function updateLocal(key: string, value: string) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, value } : r)));
  }

  return (
    <div className="grid gap-4 max-w-2xl">
      {rows.map((s) => (
        <SettingRow key={s.key} setting={s} onChange={updateLocal} />
      ))}
      {rows.length === 0 && (
        <p className="opacity-60 text-sm">No settings registered yet.</p>
      )}
      <AnnouncementCard
        eligible={eligible}
        onSent={(remaining) => setEligible(remaining)}
      />
    </div>
  );
}

function SettingRow({
  setting,
  onChange,
}: {
  setting: Setting;
  onChange: (key: string, value: string) => void;
}) {
  const [draft, setDraft] = useState(setting.value ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const dirty = draft.trim() !== (setting.value ?? "").trim();

  async function save() {
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: setting.key, value: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        setStatus("error");
        return;
      }
      onChange(setting.key, data.value ?? "");
      setDraft(data.value ?? "");
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setError("Network error");
      setStatus("error");
    }
  }

  return (
    <div className="card">
      <div className="mb-3">
        <p className="font-semibold">{setting.label}</p>
        {setting.description && (
          <p className="text-sm opacity-70 mt-1">{setting.description}</p>
        )}
        <p className="text-xs opacity-50 mt-2">
          Key: <code>{setting.key}</code>
          {setting.updated_at && (
            <>
              {" · "}Updated{" "}
              {new Date(setting.updated_at).toLocaleString()}
              {setting.updated_by ? ` by ${setting.updated_by}` : ""}
            </>
          )}
        </p>
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Not set"
        />
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={!dirty || status === "saving"}
          style={{
            opacity: !dirty || status === "saving" ? 0.5 : 1,
            cursor: !dirty || status === "saving" ? "not-allowed" : "pointer",
          }}
        >
          {status === "saving"
            ? "Saving…"
            : status === "saved"
            ? "Saved ✓"
            : "Save"}
        </button>
      </div>

      {error && (
        <p
          className="mt-3 text-sm p-2 rounded"
          style={{
            background: "rgba(135,76,59,0.1)",
            color: "var(--ca-red)",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function AnnouncementCard({
  eligible,
  onSent,
}: {
  eligible: number;
  onSent: (remaining: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    eligible: number;
    sent: number;
    failed: number;
    message?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (eligible === 0) return;
    const ok = window.confirm(
      `Send the Triple Win announcement email to ${eligible} referrer${
        eligible === 1 ? "" : "s"
      } who haven't picked a charity yet?\n\nThis is a one-time email per referrer — already-notified referrers will be skipped if you run this again.`
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/triple-win/send-announcement", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Send failed");
        return;
      }
      setResult({
        eligible: data.eligible,
        sent: data.sent,
        failed: data.failed,
        message: data.message,
      });
      onSent(Math.max(0, eligible - data.sent));
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="mb-3">
        <p className="font-semibold">Triple Win announcement</p>
        <p className="text-sm opacity-70 mt-1">
          One-time email to active referrers who haven&apos;t picked a charity
          yet. Delivers a magic link straight to the charity picker in their
          dashboard. Already-notified referrers are skipped automatically.
        </p>
      </div>

      <div
        className="p-3 rounded text-sm mb-3"
        style={{ background: "var(--ca-cream)" }}
      >
        <strong>{eligible}</strong> referrer{eligible === 1 ? "" : "s"}{" "}
        eligible to receive this email right now.
      </div>

      <div className="flex items-center justify-end">
        <button
          className="btn btn-primary"
          onClick={send}
          disabled={busy || eligible === 0}
          style={{
            opacity: busy || eligible === 0 ? 0.5 : 1,
            cursor: busy || eligible === 0 ? "not-allowed" : "pointer",
          }}
        >
          {busy
            ? "Sending…"
            : eligible === 0
            ? "No one to notify"
            : `Send to ${eligible} referrer${eligible === 1 ? "" : "s"}`}
        </button>
      </div>

      {result && (
        <div
          className="mt-3 text-sm p-3 rounded"
          style={{
            background: "rgba(97,139,96,0.08)",
            border: "1px solid var(--ca-green)",
          }}
        >
          <p>
            <strong>{result.sent}</strong> sent
            {result.failed > 0 && (
              <>
                {" · "}
                <span style={{ color: "var(--ca-red)" }}>
                  {result.failed} failed
                </span>
              </>
            )}
          </p>
          {result.message && (
            <p className="opacity-80 mt-1">{result.message}</p>
          )}
          {result.failed > 0 && (
            <p className="opacity-80 mt-1">
              Failures are logged in the server console — check Vercel logs
              for details.
            </p>
          )}
        </div>
      )}

      {error && (
        <p
          className="mt-3 text-sm p-2 rounded"
          style={{
            background: "rgba(135,76,59,0.1)",
            color: "var(--ca-red)",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
