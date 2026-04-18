"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RewardConfig, RewardTier, InvoiceBracket } from "@/lib/supabase";
import { calculateReward, calculateCharityMatch } from "@/lib/rewards/calculate";

interface Props {
  config: RewardConfig;
  tiers: RewardTier[];
}

export default function EditConfig({ config: initialConfig, tiers: initialTiers }: Props) {
  const router = useRouter();

  return (
    <div className="space-y-8">
      <ConfigMetadataPanel config={initialConfig} onSaved={() => router.refresh()} />
      <ConfigStatusPanel config={initialConfig} onChanged={() => router.refresh()} />

      <div>
        <h2 className="text-2xl mb-4">Tiers</h2>
        <div className="space-y-5">
          {initialTiers.map((tier) => (
            <TierEditor
              key={tier.id}
              configId={initialConfig.id}
              tier={tier}
              onSaved={() => router.refresh()}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Config metadata
// ─────────────────────────────────────────────────────────────────

function ConfigMetadataPanel({
  config,
  onSaved,
}: {
  config: RewardConfig;
  onSaved: () => void;
}) {
  const [name, setName] = useState(config.name);
  const [description, setDescription] = useState(config.description || "");
  const [trafficAllocation, setTrafficAllocation] = useState(
    Number(config.traffic_allocation)
  );
  const [experimentGroup, setExperimentGroup] = useState(
    config.experiment_group || ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const dirty =
    name !== config.name ||
    description !== (config.description || "") ||
    trafficAllocation !== Number(config.traffic_allocation) ||
    experimentGroup !== (config.experiment_group || "");

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/configs/${config.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          traffic_allocation: trafficAllocation,
          experiment_group: experimentGroup || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setSavedAt(new Date());
      onSaved();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2 className="text-2xl mb-4">Settings</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Traffic allocation (%)">
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            value={trafficAllocation}
            onChange={(e) => setTrafficAllocation(parseFloat(e.target.value) || 0)}
          />
        </Field>
        <Field label="Description">
          <textarea
            className="input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="Experiment group (optional)">
          <input
            className="input"
            value={experimentGroup}
            onChange={(e) => setExperimentGroup(e.target.value)}
            placeholder="e.g. service_call_amount_test_q2"
          />
        </Field>
      </div>
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="flex items-center justify-end gap-3 mt-4">
        {savedAt && !dirty && (
          <span className="text-sm opacity-70">Saved at {savedAt.toLocaleTimeString()}</span>
        )}
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={!dirty || busy}
          style={{ opacity: !dirty || busy ? 0.5 : 1 }}
        >
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Activate / Deactivate / Duplicate
// ─────────────────────────────────────────────────────────────────

function ConfigStatusPanel({
  config,
  onChanged,
}: {
  config: RewardConfig;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive() {
    const path = config.is_active ? "deactivate" : "activate";
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/configs/${config.id}/${path}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Status change failed");
      } else {
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    const name = prompt(
      "Name for the duplicated config (e.g. 'Service Call $75 Test'):"
    );
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/configs/${config.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Duplicate failed");
        setBusy(false);
        return;
      }
      router.push(`/admin/config/${data.config.id}`);
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide opacity-60 mb-1">Status</p>
          <p className="text-xl">
            {config.is_default && (
              <span
                className="inline-block px-2 py-0.5 rounded mr-2 text-xs uppercase font-semibold"
                style={{ background: "var(--ca-green)", color: "var(--ca-cream)" }}
              >
                default
              </span>
            )}
            {config.is_active ? (
              <span style={{ color: "var(--ca-green)" }}>● Active</span>
            ) : (
              <span className="opacity-60">○ Inactive</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            onClick={duplicate}
            disabled={busy}
          >
            Duplicate
          </button>
          <button
            className="btn btn-primary"
            onClick={toggleActive}
            disabled={busy}
            style={
              config.is_active
                ? { background: "var(--ca-red)", color: "var(--ca-cream)" }
                : {}
            }
          >
            {busy ? "…" : config.is_active ? "Deactivate" : "Activate"}
          </button>
        </div>
      </div>
      {error && <ErrorMsg>{error}</ErrorMsg>}
      {config.is_default && config.is_active && (
        <p className="text-xs mt-3 opacity-70">
          Default config can&apos;t be deactivated unless another active config takes
          its place.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Tier editor with live preview
// ─────────────────────────────────────────────────────────────────

function TierEditor({
  configId,
  tier,
  onSaved,
}: {
  configId: string;
  tier: RewardTier;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<RewardTier>(tier);
  const [previewAmount, setPreviewAmount] = useState<number>(
    tier.service_category === "REPLACEMENT" ? 8000 : 250
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Cheap dirty check via JSON compare — fine for small object
  const dirty = JSON.stringify(draft) !== JSON.stringify(tier);

  function update<K extends keyof RewardTier>(key: K, value: RewardTier[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        service_category_label: draft.service_category_label,
        reward_mode: draft.reward_mode,
        flat_reward_amount: numOrNull(draft.flat_reward_amount),
        percentage_of_invoice: numOrNull(draft.percentage_of_invoice),
        percentage_reward_cap: numOrNull(draft.percentage_reward_cap),
        invoice_tier_json: draft.invoice_tier_json,
        min_invoice_total: Number(draft.min_invoice_total),
        max_invoice_total: numOrNull(draft.max_invoice_total),
        referee_discount_amount: Number(draft.referee_discount_amount),
        referee_discount_type: draft.referee_discount_type,
        referee_discount_label: draft.referee_discount_label,
        charity_match_mode: draft.charity_match_mode,
        charity_match_percent: numOrNull(draft.charity_match_percent),
        charity_match_flat: numOrNull(draft.charity_match_flat),
        charity_match_floor: Number(draft.charity_match_floor),
        charity_match_cap: numOrNull(draft.charity_match_cap),
        requires_admin_approval: draft.requires_admin_approval,
      };
      const res = await fetch(
        `/api/admin/configs/${configId}/tiers/${tier.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setSavedAt(new Date());
      onSaved();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  // Live preview math uses the same calc lib as production
  const previewReward = calculateReward(previewAmount, draft);
  const previewCharity = calculateCharityMatch(previewReward, draft);

  return (
    <div
      className="card"
      style={{
        borderLeftWidth: "4px",
        borderLeftColor: dirty ? "var(--ca-light-green)" : "var(--ca-green)",
      }}
    >
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wide opacity-60">
            {draft.service_category}
          </p>
          <h3 className="text-xl">{draft.service_category_label}</h3>
        </div>
        {dirty && (
          <span
            className="text-xs px-2 py-1 rounded-full font-semibold"
            style={{
              background: "rgba(166,153,78,0.2)",
              color: "#7a6e2c",
            }}
          >
            Unsaved
          </span>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Section title="Referrer reward">
            <Field label="Reward mode">
              <select
                className="select"
                value={draft.reward_mode}
                onChange={(e) =>
                  update("reward_mode", e.target.value as RewardTier["reward_mode"])
                }
              >
                <option value="FLAT">Flat amount</option>
                <option value="PERCENTAGE_OF_INVOICE">% of invoice</option>
                <option value="TIERED_BY_INVOICE">Tiered by invoice</option>
              </select>
            </Field>

            {draft.reward_mode === "FLAT" && (
              <Field label="Flat amount ($)">
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={draft.flat_reward_amount ?? ""}
                  onChange={(e) =>
                    update("flat_reward_amount", parseFloat(e.target.value) || 0)
                  }
                />
              </Field>
            )}

            {draft.reward_mode === "PERCENTAGE_OF_INVOICE" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="% of invoice">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={draft.percentage_of_invoice ?? ""}
                    onChange={(e) =>
                      update(
                        "percentage_of_invoice",
                        parseFloat(e.target.value) || 0
                      )
                    }
                  />
                </Field>
                <Field label="Cap ($, optional)">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={draft.percentage_reward_cap ?? ""}
                    onChange={(e) =>
                      update(
                        "percentage_reward_cap",
                        e.target.value === "" ? null : parseFloat(e.target.value)
                      )
                    }
                  />
                </Field>
              </div>
            )}

            {draft.reward_mode === "TIERED_BY_INVOICE" && (
              <BracketEditor
                brackets={(draft.invoice_tier_json as InvoiceBracket[]) || []}
                onChange={(next) => update("invoice_tier_json", next)}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Min invoice ($)">
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={draft.min_invoice_total ?? 0}
                  onChange={(e) =>
                    update(
                      "min_invoice_total",
                      parseFloat(e.target.value) || 0
                    )
                  }
                />
              </Field>
              <Field label="Max invoice ($, optional)">
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={draft.max_invoice_total ?? ""}
                  onChange={(e) =>
                    update(
                      "max_invoice_total",
                      e.target.value === "" ? null : parseFloat(e.target.value)
                    )
                  }
                />
              </Field>
            </div>
          </Section>

          <Section title="Referee discount">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select
                  className="select"
                  value={draft.referee_discount_type}
                  onChange={(e) =>
                    update(
                      "referee_discount_type",
                      e.target.value as RewardTier["referee_discount_type"]
                    )
                  }
                >
                  <option value="FLAT_OFF">Flat off</option>
                  <option value="PERCENT_OFF">% off</option>
                  <option value="FREE_MONTH">Free month</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </Field>
              <Field label="Amount">
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={draft.referee_discount_amount ?? 0}
                  onChange={(e) =>
                    update(
                      "referee_discount_amount",
                      parseFloat(e.target.value) || 0
                    )
                  }
                />
              </Field>
            </div>
            <Field label="Customer-facing label">
              <input
                className="input"
                value={draft.referee_discount_label}
                onChange={(e) => update("referee_discount_label", e.target.value)}
                placeholder="e.g. $50 off first service"
              />
            </Field>
          </Section>

          <Section title="Triple Win charity match">
            <Field label="Match mode">
              <select
                className="select"
                value={draft.charity_match_mode}
                onChange={(e) =>
                  update(
                    "charity_match_mode",
                    e.target.value as RewardTier["charity_match_mode"]
                  )
                }
              >
                <option value="PERCENTAGE">% of referrer reward</option>
                <option value="FLAT">Flat amount</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </Field>

            {draft.charity_match_mode === "PERCENTAGE" && (
              <Field label="% match">
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={draft.charity_match_percent ?? ""}
                  onChange={(e) =>
                    update(
                      "charity_match_percent",
                      parseFloat(e.target.value) || 0
                    )
                  }
                />
              </Field>
            )}

            {draft.charity_match_mode === "FLAT" && (
              <Field label="Flat match ($)">
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={draft.charity_match_flat ?? ""}
                  onChange={(e) =>
                    update(
                      "charity_match_flat",
                      parseFloat(e.target.value) || 0
                    )
                  }
                />
              </Field>
            )}

            {draft.charity_match_mode !== "DISABLED" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Floor ($)">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={draft.charity_match_floor ?? 0}
                    onChange={(e) =>
                      update(
                        "charity_match_floor",
                        parseFloat(e.target.value) || 0
                      )
                    }
                  />
                </Field>
                <Field label="Cap ($, optional)">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={draft.charity_match_cap ?? ""}
                    onChange={(e) =>
                      update(
                        "charity_match_cap",
                        e.target.value === "" ? null : parseFloat(e.target.value)
                      )
                    }
                  />
                </Field>
              </div>
            )}
          </Section>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.requires_admin_approval}
              onChange={(e) =>
                update("requires_admin_approval", e.target.checked)
              }
            />
            <span className="text-sm">
              Requires admin approval before reward is auto-issued
            </span>
          </label>
        </div>

        {/* Live preview */}
        <div>
          <div
            className="card sticky top-4"
            style={{
              background: "rgba(97,139,96,0.08)",
              borderColor: "var(--ca-green)",
            }}
          >
            <p className="text-xs uppercase tracking-wide opacity-60 mb-3">
              Live preview
            </p>
            <Field label="Test invoice amount ($)">
              <input
                className="input"
                type="number"
                min={0}
                value={previewAmount}
                onChange={(e) => setPreviewAmount(parseFloat(e.target.value) || 0)}
              />
            </Field>
            <div className="mt-4 space-y-2">
              <PreviewRow
                label="Referrer reward"
                value={`$${previewReward.toFixed(0)}`}
              />
              <PreviewRow
                label="Referee saves"
                value={draft.referee_discount_label}
                small
              />
              <PreviewRow
                label="Charity match (Triple Win)"
                value={
                  previewCharity > 0
                    ? `$${previewCharity.toFixed(0)}`
                    : draft.charity_match_mode === "DISABLED"
                      ? "—"
                      : "$0 (below floor)"
                }
              />
            </div>
            <p className="text-xs opacity-60 mt-4">
              Recalculates as you edit. Mirrors the production reward engine.
            </p>
          </div>
        </div>
      </div>

      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="flex items-center justify-end gap-3 mt-6">
        {savedAt && !dirty && (
          <span className="text-sm opacity-70">
            Saved at {savedAt.toLocaleTimeString()}
          </span>
        )}
        {dirty && (
          <button
            className="btn btn-secondary"
            onClick={() => setDraft(tier)}
            disabled={busy}
          >
            Reset
          </button>
        )}
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={!dirty || busy}
          style={{ opacity: !dirty || busy ? 0.5 : 1 }}
        >
          {busy ? "Saving…" : "Save tier"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Bracket editor (for TIERED_BY_INVOICE mode)
// ─────────────────────────────────────────────────────────────────

function BracketEditor({
  brackets,
  onChange,
}: {
  brackets: InvoiceBracket[];
  onChange: (next: InvoiceBracket[]) => void;
}) {
  function setBracket(i: number, patch: Partial<InvoiceBracket>) {
    const next = brackets.map((b, idx) => (idx === i ? { ...b, ...patch } : b));
    onChange(next);
  }
  function addBracket() {
    onChange([
      ...brackets,
      { minInvoice: 0, maxInvoice: null, rewardAmount: 0 },
    ]);
  }
  function removeBracket(i: number) {
    onChange(brackets.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <p className="text-sm font-semibold mb-2">Invoice brackets</p>
      <div className="space-y-2">
        {brackets.map((b, i) => (
          <div key={i} className="grid grid-cols-7 gap-2 items-center">
            <input
              className="input col-span-2"
              type="number"
              placeholder="Min $"
              value={b.minInvoice}
              onChange={(e) =>
                setBracket(i, { minInvoice: parseFloat(e.target.value) || 0 })
              }
            />
            <input
              className="input col-span-2"
              type="number"
              placeholder="Max $ (blank = no cap)"
              value={b.maxInvoice ?? ""}
              onChange={(e) =>
                setBracket(i, {
                  maxInvoice:
                    e.target.value === "" ? null : parseFloat(e.target.value),
                })
              }
            />
            <input
              className="input col-span-2"
              type="number"
              placeholder="Reward $"
              value={b.rewardAmount}
              onChange={(e) =>
                setBracket(i, {
                  rewardAmount: parseFloat(e.target.value) || 0,
                })
              }
            />
            <button
              type="button"
              className="text-sm opacity-60 hover:opacity-100"
              onClick={() => removeBracket(i)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="text-sm font-semibold mt-2"
        style={{ color: "var(--ca-green)" }}
        onClick={addBracket}
      >
        + Add bracket
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function numOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold mb-1.5 opacity-80">
        {label}
      </span>
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-bold mb-3 pb-1" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        {title}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-sm opacity-70">{label}</span>
      <span
        className={small ? "text-sm" : "text-xl font-semibold"}
        style={{
          fontFamily: small ? undefined : "var(--font-lobster)",
          color: "var(--ca-dark-green)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mt-3 p-3 rounded-lg text-sm"
      style={{
        background: "rgba(135,76,59,0.1)",
        color: "var(--ca-red)",
        border: "1px solid var(--ca-red)",
      }}
    >
      {children}
    </p>
  );
}
