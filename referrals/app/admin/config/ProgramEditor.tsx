"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const BASELINE = { referrer_amount: 50, friend_amount: 50, charity_amount: 50 };

interface Current {
  config_id: string;
  referrer_amount: number;
  friend_amount: number;
  charity_amount: number;
  campaign_label: string | null;
}

interface HistoryEntry {
  id: string;
  changed_at: string;
  admin_email: string | null;
  before_json: {
    referrer_amount?: number;
    friend_amount?: number;
    charity_amount?: number;
    campaign_label?: string | null;
  } | null;
  after_json: {
    referrer_amount?: number;
    friend_amount?: number;
    charity_amount?: number;
    campaign_label?: string | null;
  } | null;
}

type ConfirmState =
  | { kind: "hidden" }
  | { kind: "standard" }
  | { kind: "stale-lie" };

export default function ProgramEditor({
  initial,
  history,
}: {
  initial: Current;
  history: HistoryEntry[];
}) {
  const router = useRouter();
  const [referrer, setReferrer] = useState(initial.referrer_amount);
  const [friend, setFriend] = useState(initial.friend_amount);
  const [charity, setCharity] = useState(initial.charity_amount);
  const [label, setLabel] = useState(initial.campaign_label ?? "");
  const [confirm, setConfirm] = useState<ConfirmState>({ kind: "hidden" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const dirty =
    referrer !== initial.referrer_amount ||
    friend !== initial.friend_amount ||
    charity !== initial.charity_amount ||
    (label || null) !== initial.campaign_label;

  const valid = referrer >= 1 && friend >= 1 && charity >= 1;

  function requestSave() {
    if (!valid || !dirty) return;
    setError(null);

    const normalizedLabel = label.trim() || null;
    const atBaseline =
      referrer === BASELINE.referrer_amount &&
      friend === BASELINE.friend_amount &&
      charity === BASELINE.charity_amount;

    // Stale-lie guard: if amounts returned to baseline but label is still set,
    // force a deliberate choice between keep/clear/cancel.
    if (atBaseline && normalizedLabel) {
      setConfirm({ kind: "stale-lie" });
      return;
    }

    setConfirm({ kind: "standard" });
  }

  async function doSave(overrideLabel?: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referrer_amount: referrer,
          friend_amount: friend,
          charity_amount: charity,
          campaign_label:
            overrideLabel !== undefined ? overrideLabel : label.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        setBusy(false);
        setConfirm({ kind: "hidden" });
        return;
      }
      setSavedAt(new Date());
      setConfirm({ kind: "hidden" });
      if (overrideLabel === null) setLabel("");
      router.refresh();
    } catch {
      setError("Network error");
      setConfirm({ kind: "hidden" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Current program editor */}
      <section className="card">
        <h2 className="text-2xl mb-4">Current program</h2>

        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <AmountField
            label="Referrer"
            sublabel="Gift card to the referrer"
            value={referrer}
            onChange={setReferrer}
          />
          <AmountField
            label="Friend"
            sublabel="Discount on their first service"
            value={friend}
            onChange={setFriend}
          />
          <AmountField
            label="Charity"
            sublabel="Donation to referrer's chosen charity"
            value={charity}
            onChange={setCharity}
          />
        </div>

        <div className="mt-6">
          <label className="block text-sm font-semibold mb-1">
            Campaign label <span className="opacity-60 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={200}
            placeholder='e.g. "Double Your Charity — April"'
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--bg-muted)",
              border: "1px solid var(--border-default)",
              color: "inherit",
            }}
          />
          <p className="text-xs opacity-70 mt-2">
            When filled, shows a banner on /dashboard, /refer/[code], and /enroll.
            Leave blank to hide the banner.
          </p>
        </div>

        <div className="flex items-center gap-4 mt-6">
          <button
            type="button"
            disabled={!dirty || !valid || busy}
            onClick={requestSave}
            className="px-4 py-2 rounded-lg font-semibold text-sm"
            style={{
              background: dirty && valid ? "var(--ca-green)" : "var(--bg-muted)",
              color: dirty && valid ? "white" : "var(--text-muted, inherit)",
              opacity: dirty && valid ? 1 : 0.5,
              cursor: dirty && valid ? "pointer" : "not-allowed",
            }}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
          {!valid && (
            <span className="text-sm" style={{ color: "#c55" }}>
              All three amounts must be at least $1.
            </span>
          )}
          {error && (
            <span className="text-sm" style={{ color: "#c55" }}>
              {error}
            </span>
          )}
          {savedAt && !dirty && (
            <span className="text-sm opacity-70">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      </section>

      {/* Live preview */}
      <LivePreview
        referrer={referrer}
        friend={friend}
        charity={charity}
        label={label.trim() || null}
      />

      {/* History */}
      <HistoryPanel history={history} />

      {/* Confirm modals */}
      {confirm.kind === "standard" && (
        <ConfirmModal
          title="Save changes?"
          body="This takes effect immediately for all new referrals. Continue?"
          primaryLabel="Save"
          onPrimary={() => doSave()}
          onCancel={() => setConfirm({ kind: "hidden" })}
          busy={busy}
        />
      )}

      {confirm.kind === "stale-lie" && (
        <StaleLabelModal
          label={label.trim()}
          busy={busy}
          onKeepBanner={() => doSave()}
          onClearBanner={() => doSave(null)}
          onCancel={() => setConfirm({ kind: "hidden" })}
        />
      )}
    </div>
  );
}

function AmountField({
  label,
  sublabel,
  value,
  onChange,
}: {
  label: string;
  sublabel: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <span className="opacity-70">$</span>
        <input
          type="number"
          min={1}
          max={10000}
          step={1}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
          className="w-full px-3 py-2 rounded-lg text-lg"
          style={{
            background: "var(--bg-muted)",
            border: "1px solid var(--border-default)",
            color: "inherit",
          }}
        />
      </div>
      <p className="text-xs opacity-60 mt-1">{sublabel}</p>
    </div>
  );
}

function LivePreview({
  referrer,
  friend,
  charity,
  label,
}: {
  referrer: number;
  friend: number;
  charity: number;
  label: string | null;
}) {
  return (
    <section className="card">
      <h2 className="text-2xl mb-4">Live preview</h2>
      <div className="space-y-3 text-sm">
        {label && (
          <PreviewRow
            where="Banner (/dashboard, /refer/[code], /enroll)"
            text={label}
            emphasis
          />
        )}
        <PreviewRow
          where="Homepage + /triple-win hero"
          text={`You get $${referrer}. They save $${friend}. $${charity} goes to charity.`}
        />
        <PreviewRow
          where="/faq earnings line"
          text={`$${referrer} referrer reward, $${friend} friend discount, $${charity} charity donation.`}
        />
        <PreviewRow
          where="/terms"
          text={`Rewards are $${referrer} to the referrer, $${friend} to the friend, and $${charity} to charity per completed referral. Amounts subject to change.`}
        />
      </div>
    </section>
  );
}

function PreviewRow({
  where,
  text,
  emphasis,
}: {
  where: string;
  text: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className="p-3 rounded-lg grid gap-1"
      style={{
        background: emphasis ? "var(--ca-green-muted, var(--bg-muted))" : "var(--bg-muted)",
        borderLeft: emphasis ? "3px solid var(--ca-green)" : "none",
      }}
    >
      <span className="text-xs uppercase tracking-wide opacity-60">{where}</span>
      <span>{text}</span>
    </div>
  );
}

function HistoryPanel({ history }: { history: HistoryEntry[] }) {
  return (
    <section className="card">
      <h2 className="text-2xl mb-4">History</h2>
      {history.length === 0 ? (
        <p className="opacity-70 text-sm">
          No changes logged yet. Save the form above to begin the history trail.
        </p>
      ) : (
        <div className="space-y-3">
          {history.map((h) => (
            <HistoryRow key={h.id} entry={h} />
          ))}
        </div>
      )}
    </section>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const before = entry.before_json || {};
  const after = entry.after_json || {};
  const changes = useMemo(() => {
    const parts: string[] = [];
    if (before.referrer_amount !== after.referrer_amount) {
      parts.push(`referrer $${before.referrer_amount ?? "—"} → $${after.referrer_amount ?? "—"}`);
    }
    if (before.friend_amount !== after.friend_amount) {
      parts.push(`friend $${before.friend_amount ?? "—"} → $${after.friend_amount ?? "—"}`);
    }
    if (before.charity_amount !== after.charity_amount) {
      parts.push(`charity $${before.charity_amount ?? "—"} → $${after.charity_amount ?? "—"}`);
    }
    if ((before.campaign_label ?? null) !== (after.campaign_label ?? null)) {
      const from = before.campaign_label ? `"${before.campaign_label}"` : "none";
      const to = after.campaign_label ? `"${after.campaign_label}"` : "none";
      parts.push(`label ${from} → ${to}`);
    }
    return parts;
  }, [before, after]);

  return (
    <div
      className="p-3 rounded-lg text-sm"
      style={{ background: "var(--bg-muted)" }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="opacity-70 text-xs">
          {new Date(entry.changed_at).toLocaleString()}
          {entry.admin_email && <> · {entry.admin_email}</>}
        </span>
      </div>
      {changes.length === 0 ? (
        <span className="opacity-60 italic">No detectable change</span>
      ) : (
        <ul className="list-none pl-0">
          {changes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConfirmModal({
  title,
  body,
  primaryLabel,
  onPrimary,
  onCancel,
  busy,
}: {
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <ModalShell>
      <h3 className="text-xl mb-3">{title}</h3>
      <p className="mb-5 opacity-80">{body}</p>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-4 py-2 rounded-lg text-sm"
          style={{ background: "var(--bg-muted)", color: "inherit" }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onPrimary}
          disabled={busy}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--ca-green)", color: "white" }}
        >
          {busy ? "Saving…" : primaryLabel}
        </button>
      </div>
    </ModalShell>
  );
}

function StaleLabelModal({
  label,
  busy,
  onKeepBanner,
  onClearBanner,
  onCancel,
}: {
  label: string;
  busy: boolean;
  onKeepBanner: () => void;
  onClearBanner: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalShell>
      <h3 className="text-xl mb-3">Campaign banner still active</h3>
      <p className="mb-2 opacity-80">
        Amounts are back to baseline ($50 / $50 / $50), but the campaign banner
        is still set to:
      </p>
      <div
        className="p-3 rounded-lg mb-5 text-sm font-semibold"
        style={{
          background: "var(--bg-muted)",
          borderLeft: "3px solid var(--ca-green)",
        }}
      >
        {label}
      </div>
      <p className="mb-5 opacity-80 text-sm">
        The banner will continue to promote this on /dashboard, /refer/[code],
        and /enroll even though the promo amounts are no longer active. Keep it
        or clear it?
      </p>
      <div className="flex gap-2 justify-end flex-wrap">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-4 py-2 rounded-lg text-sm"
          style={{ background: "var(--bg-muted)", color: "inherit" }}
        >
          Cancel save
        </button>
        <button
          type="button"
          onClick={onKeepBanner}
          disabled={busy}
          className="px-4 py-2 rounded-lg text-sm"
          style={{ background: "var(--bg-muted)", color: "inherit", border: "1px solid var(--border-default)" }}
        >
          Keep banner
        </button>
        <button
          type="button"
          onClick={onClearBanner}
          disabled={busy}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--ca-green)", color: "white" }}
        >
          {busy ? "Saving…" : "Clear banner"}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="card max-w-md w-full"
        style={{ background: "var(--bg-card)" }}
      >
        {children}
      </div>
    </div>
  );
}
