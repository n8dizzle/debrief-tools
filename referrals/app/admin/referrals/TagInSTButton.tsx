"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  referralId: string;
  customerId: string | null;
  /** ISO timestamp of when the Referral Code was last written to ST, or null. */
  taggedAt: string | null;
}

/**
 * Writes the referrer's code into the linked ST customer's "Referral Code"
 * custom field (via /tag-st). Once written, ref_referrals.tagged_in_st_at is
 * stamped, so this renders a persisted "✓ Referral code set" state with a
 * small re-set option (ST's PATCH is idempotent, so re-setting is harmless —
 * handy if the field was cleared in ServiceTitan).
 *
 * Only meaningful when the referral has a linked ST customer.
 */
export default function TagInSTButton({ referralId, customerId, taggedAt }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [justSet, setJustSet] = useState(false);

  if (!customerId) {
    return (
      <span
        className="text-[10px] opacity-50"
        title="No ST customer linked to this referral yet — link one in the ST Customer column first."
      >
        no customer linked
      </span>
    );
  }

  const isSet = justSet || !!taggedAt;

  async function setCode() {
    setState("busy");
    setError(null);
    try {
      const res = await fetch(`/api/admin/referrals/${referralId}/tag-st`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to set Referral Code");
        setState("error");
        return;
      }
      setJustSet(true);
      setState("idle");
      router.refresh();
    } catch {
      setError("Network error");
      setState("error");
    }
  }

  if (isSet) {
    return (
      <div className="flex flex-col gap-0.5">
        <span
          className="text-[10px] font-semibold"
          style={{ color: "var(--ca-green)" }}
        >
          ✓ Referral code set
        </span>
        <button
          type="button"
          onClick={setCode}
          disabled={state === "busy"}
          className="text-[10px] opacity-40 hover:opacity-70 underline self-start"
          style={{ color: "inherit", cursor: state === "busy" ? "wait" : "pointer" }}
          title="Re-write the Referral Code to this ST customer (in case it was cleared in ServiceTitan)"
        >
          {state === "busy" ? "setting…" : "re-set"}
        </button>
        {error && (
          <span
            className="text-[10px]"
            style={{ color: "var(--ca-red)", maxWidth: 220 }}
            title={error}
          >
            {error.slice(0, 80)}
            {error.length > 80 ? "…" : ""}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={setCode}
        disabled={state === "busy"}
        className="text-[10px] font-semibold underline self-start"
        style={{
          color: state === "error" ? "var(--ca-red)" : "var(--ca-dark-green)",
          opacity: state === "busy" ? 0.6 : 1,
          cursor: state === "busy" ? "wait" : "pointer",
        }}
        title="Write the referrer's code into this ST customer's Referral Code field"
      >
        {state === "busy"
          ? "setting…"
          : state === "error"
          ? "retry — Set Referral Code in ST"
          : "Set Referral Code in ST"}
      </button>
      {error && (
        <span
          className="text-[10px]"
          style={{ color: "var(--ca-red)", maxWidth: 220 }}
          title={error}
        >
          {error.slice(0, 80)}
          {error.length > 80 ? "…" : ""}
        </span>
      )}
    </div>
  );
}
