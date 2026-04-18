"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Charity } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";

interface Props {
  initialEnabled: boolean;
  initialCharityId: string | null;
  charities: Charity[];
}

export default function CharityForm({
  initialEnabled,
  initialCharityId,
  charities,
}: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [charityId, setCharityId] = useState<string | null>(initialCharityId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const dirty =
    enabled !== initialEnabled || charityId !== initialCharityId;
  const canSave = !enabled || !!charityId;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/charity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripleWinEnabled: enabled,
          selectedCharityId: enabled ? charityId : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setSavedAt(new Date());
      if (enabled !== initialEnabled) {
        trackEvent("triple_win_toggled", { enabled });
      }
      if (charityId !== initialCharityId) {
        trackEvent("charity_changed", { from: initialCharityId, to: charityId });
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <label
        className="flex items-start gap-3 p-4 rounded-lg cursor-pointer mb-4"
        style={{
          border: `2px solid ${
            enabled ? "var(--ca-green)" : "var(--border-subtle)"
          }`,
          background: enabled ? "rgba(97,139,96,0.06)" : "var(--bg-card)",
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            if (!e.target.checked) setCharityId(null);
          }}
          className="mt-1"
        />
        <div>
          <p className="font-semibold">Triple Win is {enabled ? "ON" : "OFF"}</p>
          <p className="text-sm opacity-70">
            {enabled
              ? "Every successful referral will trigger a matched donation."
              : "Turn this on to add a charity match to every referral. You keep your full reward."}
          </p>
        </div>
      </label>

      {enabled && (
        <div className="mb-4">
          <p className="font-semibold mb-3">Your charity</p>
          <div className="grid gap-3">
            {charities.map((c) => (
              <label
                key={c.id}
                className="flex items-start gap-3 p-4 rounded-lg cursor-pointer"
                style={{
                  border: `2px solid ${
                    charityId === c.id ? "var(--ca-green)" : "var(--border-subtle)"
                  }`,
                  background:
                    charityId === c.id
                      ? "rgba(97,139,96,0.06)"
                      : "var(--bg-card)",
                }}
              >
                <input
                  type="radio"
                  name="charity"
                  value={c.id}
                  checked={charityId === c.id}
                  onChange={() => setCharityId(c.id)}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm opacity-70 mt-1">{c.description}</p>
                </div>
              </label>
            ))}
          </div>
          <p className="text-xs opacity-60 mt-3">
            Note: changing your charity does not affect referrals already in
            flight. Each referral keeps the charity selected at submission.
          </p>
        </div>
      )}

      {error && (
        <p
          className="mb-4 p-3 rounded-lg text-sm"
          style={{
            background: "rgba(135,76,59,0.1)",
            color: "var(--ca-red)",
            border: "1px solid var(--ca-red)",
          }}
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-between mt-2">
        <p className="text-sm opacity-70">
          {savedAt && !dirty
            ? `Saved at ${savedAt.toLocaleTimeString()}`
            : ""}
        </p>
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={!dirty || !canSave || busy}
          style={{
            opacity: !dirty || !canSave || busy ? 0.5 : 1,
            cursor: !dirty || !canSave || busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
