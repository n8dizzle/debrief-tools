"use client";

import { useState } from "react";

export interface TremendousEnvInfo {
  apiKeySet: boolean;
  env: string;
  fundingSourceId: string | null;
  campaignId: string | null;
  charityProductId: string | null;
}

export default function TremendousTester({
  env,
  adminEmail,
}: {
  env: TremendousEnvInfo;
  adminEmail: string;
}) {
  const isProd = env.env === "production";
  // Valid config: API key + funding source + campaign for gift-card routing.
  // Charity product ID is optional — we'll wire per-charity IDs later.
  const configured =
    env.apiKeySet && !!env.fundingSourceId && !!env.campaignId;

  return (
    <div className="space-y-6">
      {isProd && (
        <div
          className="p-4 rounded-lg"
          style={{
            background: "rgba(135,76,59,0.1)",
            border: "2px solid var(--ca-red)",
          }}
        >
          <p className="font-semibold" style={{ color: "var(--ca-red)" }}>
            ⚠ You are in PRODUCTION mode
          </p>
          <p className="text-sm mt-1">
            Test orders on this page will charge the real Tremendous funding
            source and actually deliver gift cards. Set{" "}
            <code>TREMENDOUS_ENV=sandbox</code> in your environment for
            risk-free testing instead.
          </p>
        </div>
      )}

      <EnvStatusCard env={env} configured={configured} />
      <PingCard configured={configured} />
      <TestOrderCard
        configured={configured}
        isProd={isProd}
        adminEmail={adminEmail}
      />
    </div>
  );
}

function EnvStatusCard({
  env,
  configured,
}: {
  env: TremendousEnvInfo;
  configured: boolean;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="font-semibold">Environment</p>
          <p className="text-sm opacity-70 mt-1">
            These are read from <code>TREMENDOUS_*</code> env vars at request
            time. Change them in <code>.env.local</code> (dev) or Vercel
            project settings (prod).
          </p>
        </div>
        <Badge
          tone={configured ? "ok" : "warn"}
          label={configured ? "Configured" : "Not configured"}
        />
      </div>
      <table className="w-full text-sm">
        <tbody>
          <StatusRow
            label="Mode"
            value={env.env}
            tone={env.env === "sandbox" ? "ok" : "warn"}
          />
          <StatusRow
            label="API key"
            value={env.apiKeySet ? "set" : "missing"}
            tone={env.apiKeySet ? "ok" : "err"}
          />
          <StatusRow
            label="Funding source"
            value={env.fundingSourceId || "missing"}
            tone={env.fundingSourceId ? "ok" : "err"}
          />
          <StatusRow
            label="Campaign ID"
            value={env.campaignId || "missing"}
            tone={env.campaignId ? "ok" : "err"}
          />
          <StatusRow
            label="Charity product"
            value={env.charityProductId || "not set (deferred)"}
            tone={env.charityProductId ? "ok" : "muted"}
          />
        </tbody>
      </table>
    </div>
  );
}

function PingCard({ configured }: { configured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; reason: string } | null>(
    null
  );

  async function ping() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/tremendous/ping", { method: "POST" });
      const data = await res.json();
      setResult({ ok: !!data.ok, reason: data.reason || data.error || "" });
    } catch {
      setResult({ ok: false, reason: "Network error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="font-semibold">Ping Tremendous</p>
          <p className="text-sm opacity-70 mt-1">
            Hits the funding sources endpoint to verify your credentials
            actually authenticate. No money moves, no orders created.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={ping}
          disabled={!configured || busy}
          style={{
            opacity: !configured || busy ? 0.5 : 1,
            cursor: !configured || busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Pinging…" : "Ping"}
        </button>
      </div>
      {result && (
        <div
          className="p-3 rounded text-sm"
          style={{
            background: result.ok
              ? "rgba(97,139,96,0.1)"
              : "rgba(135,76,59,0.1)",
            color: result.ok ? "var(--ca-dark-green)" : "var(--ca-red)",
            border: `1px solid ${result.ok ? "var(--ca-green)" : "var(--ca-red)"}`,
          }}
        >
          <p className="font-semibold">
            {result.ok ? "✓ Connected" : "✗ Failed"}
          </p>
          {result.reason && (
            <p className="opacity-80 mt-1">{result.reason}</p>
          )}
        </div>
      )}
    </div>
  );
}

function TestOrderCard({
  configured,
  isProd,
  adminEmail,
}: {
  configured: boolean;
  isProd: boolean;
  adminEmail: string;
}) {
  const [email, setEmail] = useState(adminEmail);
  const [name, setName] = useState("Test Recipient");
  // Default $5 — most Tremendous campaigns have a $5 floor because specific
  // merchant cards (Target, Best Buy) enforce $5 minimums. $1 often fails
  // validation with "does not meet the minimum for available products".
  const [amount, setAmount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; orderId: string; status: string }
    | { ok: false; error: string }
    | null
  >(null);

  async function send() {
    if (isProd) {
      const ok = window.confirm(
        `⚠ You are in PRODUCTION mode.\n\nThis will charge your Tremendous funding source $${amount} and deliver a real gift card to ${email}.\n\nContinue?`
      );
      if (!ok) return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/tremendous/test-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: name,
          recipientEmail: email,
          amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, error: data.error || "Request failed" });
        return;
      }
      setResult({ ok: true, orderId: data.orderId, status: data.status });
    } catch {
      setResult({ ok: false, error: "Network error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <p className="font-semibold">Send a test reward</p>
      <p className="text-sm opacity-70 mt-1 mb-4">
        Sends a gift-card order through the configured Tremendous campaign —
        recipient picks their card at redemption.{" "}
        {isProd ? (
          <strong style={{ color: "var(--ca-red)" }}>
            PRODUCTION mode: charges funding source, delivers a real card.
          </strong>
        ) : (
          <span>Sandbox: play money, safe to run.</span>
        )}
        {" "}
        Cap is <strong>$100</strong> per order for safety.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Field label="Amount ($)">
          <input
            className="input"
            type="number"
            min={1}
            max={100}
            step={1}
            value={amount}
            onChange={(e) =>
              setAmount(Math.max(1, Math.min(100, Number(e.target.value) || 0)))
            }
          />
        </Field>
        <Field label="Recipient name">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Recipient email">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          className="btn btn-primary"
          onClick={send}
          disabled={!configured || busy}
          style={{
            opacity: !configured || busy ? 0.5 : 1,
            cursor: !configured || busy ? "not-allowed" : "pointer",
            background: isProd ? "var(--ca-red)" : undefined,
          }}
        >
          {busy ? "Sending…" : isProd ? "Send in PRODUCTION" : "Send test order"}
        </button>
      </div>

      {result && result.ok && (() => {
        const pending = result.status === "pending_approval";
        const host = isProd
          ? "app.tremendous.com"
          : "testflight.tremendous.com";
        return (
          <div
            className="mt-4 p-3 rounded text-sm"
            style={{
              background: pending
                ? "rgba(166,153,78,0.15)"
                : "rgba(97,139,96,0.1)",
              border: `1px solid ${pending ? "var(--ca-light-green)" : "var(--ca-green)"}`,
              color: "var(--ca-dark-green)",
            }}
          >
            <p className="font-semibold">
              {pending
                ? "⏳ Order created — pending approval in Tremendous"
                : "✓ Order created and delivered"}
            </p>
            <p className="opacity-80 mt-1">
              Tremendous order ID: <code>{result.orderId}</code>{" "}
              <span className="opacity-60">(status: {result.status})</span>
            </p>
            {pending ? (
              <p className="opacity-80 mt-1">
                No email has been sent yet. Log into{" "}
                <a
                  href={`https://${host}/dashboard/orders`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--ca-dark-green)", textDecoration: "underline" }}
                >
                  {host}
                </a>{" "}
                to approve or decline the order. Approval triggers delivery.
              </p>
            ) : (
              <p className="opacity-80 mt-1">
                Check {host} to see the order in their dashboard.
              </p>
            )}
          </div>
        );
      })()}

      {result && !result.ok && (
        <div
          className="mt-4 p-3 rounded text-sm"
          style={{
            background: "rgba(135,76,59,0.1)",
            border: "1px solid var(--ca-red)",
            color: "var(--ca-red)",
          }}
        >
          <p className="font-semibold">✗ Failed</p>
          <p className="opacity-90 mt-1">{result.error}</p>
        </div>
      )}
    </div>
  );
}

// ─── Small UI atoms ───────────────────────────────────────────────────

type Tone = "ok" | "warn" | "err" | "muted";

const TONE_COLOR: Record<Tone, string> = {
  ok: "var(--ca-green)",
  warn: "var(--ca-light-green)",
  err: "var(--ca-red)",
  muted: "var(--text-muted)",
};

function Badge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{
        background: tone === "ok" ? "rgba(97,139,96,0.15)" : "rgba(166,153,78,0.2)",
        color: TONE_COLOR[tone],
      }}
    >
      {label}
    </span>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: Tone;
}) {
  return (
    <tr style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <td className="py-2 text-sm opacity-70" style={{ width: "35%" }}>
        {label}
      </td>
      <td className="py-2">
        <code
          className="text-xs px-2 py-0.5 rounded"
          style={{
            background: "var(--bg-muted)",
            color: TONE_COLOR[tone],
          }}
        >
          {value}
        </code>
      </td>
    </tr>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold mb-1.5 opacity-80">
        {label}
      </span>
      {children}
    </label>
  );
}
