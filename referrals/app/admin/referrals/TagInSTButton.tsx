"use client";

import { useState } from "react";

interface Props {
  referralId: string;
  customerId: string | null;
}

/**
 * One-click button that writes the referrer's code to the ST customer's
 * Referral_Code custom field. Only rendered when the referral has a
 * linked ST customer — otherwise the server-side endpoint has nothing to
 * patch. Displays idle / tagging / ✓ tagged / error states.
 *
 * Success is indicated but not persisted — hitting the button again writes
 * the same value (ST's PATCH is idempotent on the same typeId). Admin can
 * re-tag without consequence, useful if the ST field was cleared.
 */
export default function TagInSTButton({ referralId, customerId }: Props) {
  const [state, setState] = useState<"idle" | "tagging" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  if (!customerId) {
    return (
      <span
        className="text-[10px] opacity-50"
        title="No ST customer linked to this referral yet — can't tag. The service_titan_customer_id gets stamped automatically after the first matched invoice webhook, or an admin can set it manually."
      >
        no customer linked
      </span>
    );
  }

  async function tag() {
    setState("tagging");
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/referrals/${referralId}/tag-st`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Tag failed");
        setState("error");
        return;
      }
      setState("done");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setError("Network error");
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={tag}
        disabled={state === "tagging"}
        className="text-[10px] font-semibold underline"
        style={{
          color:
            state === "done"
              ? "var(--ca-green)"
              : state === "error"
              ? "var(--ca-red)"
              : "var(--ca-dark-green)",
          opacity: state === "tagging" ? 0.6 : 1,
          cursor: state === "tagging" ? "wait" : "pointer",
        }}
        title={`Write the referral code to this ST customer's Referral_Code custom field`}
      >
        {state === "tagging"
          ? "tagging…"
          : state === "done"
          ? "✓ tagged"
          : state === "error"
          ? "retry tag"
          : "tag in ST"}
      </button>
      {error && (
        <span
          className="text-[10px]"
          style={{ color: "var(--ca-red)", maxWidth: 180 }}
          title={error}
        >
          {error.slice(0, 60)}
          {error.length > 60 ? "…" : ""}
        </span>
      )}
    </div>
  );
}
