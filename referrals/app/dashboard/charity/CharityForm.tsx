"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Charity } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";

interface Props {
  initialCharityId: string | null;
  charities: Charity[];
}

export default function CharityForm({
  initialCharityId,
  charities,
}: Props) {
  const router = useRouter();
  const [charityId, setCharityId] = useState<string | null>(initialCharityId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const dirty = charityId !== initialCharityId;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/charity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedCharityId: charityId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setSavedAt(new Date());
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
        Changing your charity does not affect referrals already in flight — each
        referral keeps the charity selected at submission time.
      </p>

      {error && (
        <p
          className="mt-4 p-3 rounded-lg text-sm"
          style={{
            background: "rgba(135,76,59,0.1)",
            color: "var(--ca-red)",
            border: "1px solid var(--ca-red)",
          }}
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-between mt-4">
        <p className="text-sm opacity-70">
          {savedAt && !dirty
            ? `Saved at ${savedAt.toLocaleTimeString()}`
            : ""}
        </p>
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={!dirty || !charityId || busy}
          style={{
            opacity: !dirty || !charityId || busy ? 0.5 : 1,
            cursor: !dirty || !charityId || busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Saving…" : "Save charity"}
        </button>
      </div>
    </div>
  );
}
