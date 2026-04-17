"use client";

import { useState } from "react";

type ServiceType =
  | "HVAC_SERVICE_CALL"
  | "HVAC_MAINTENANCE"
  | "HVAC_INSTALLATION"
  | "PLUMBING_SERVICE_CALL"
  | "PLUMBING_MAINTENANCE"
  | "PLUMBING_INSTALLATION"
  | "WATER_HEATER"
  | "COMMERCIAL"
  | "OTHER";

const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: "HVAC_SERVICE_CALL", label: "HVAC repair / not cooling / not heating" },
  { value: "HVAC_MAINTENANCE", label: "HVAC tune-up or maintenance plan" },
  { value: "HVAC_INSTALLATION", label: "New HVAC system or replacement" },
  { value: "PLUMBING_SERVICE_CALL", label: "Plumbing repair / leak / drain" },
  { value: "PLUMBING_MAINTENANCE", label: "Plumbing inspection / maintenance" },
  { value: "PLUMBING_INSTALLATION", label: "New fixtures or re-piping" },
  { value: "WATER_HEATER", label: "Water heater (repair or replace)" },
  { value: "COMMERCIAL", label: "Commercial property / business" },
  { value: "OTHER", label: "Something else" },
];

interface Props {
  referralCode: string;
  referrerFirstName: string;
  tripleWinCharityName: string | null;
}

export default function ReferralForm({
  referralCode,
  referrerFirstName,
  tripleWinCharityName,
}: Props) {
  const [referredName, setReferredName] = useState("");
  const [referredPhone, setReferredPhone] = useState("");
  const [referredEmail, setReferredEmail] = useState("");
  const [referredAddress, setReferredAddress] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType | "">("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    refereeDiscountLabel: string;
    tripleWinCharityName: string | null;
  } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceType) {
      setError("Please pick what you need help with.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralCode,
          referredName: referredName.trim(),
          referredPhone: referredPhone.trim(),
          referredEmail: referredEmail.trim() || null,
          referredAddress: referredAddress.trim() || null,
          serviceType,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setSubmitting(false);
        return;
      }
      setResult({
        refereeDiscountLabel: data.refereeDiscountLabel,
        tripleWinCharityName: data.tripleWinCharityName,
      });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const firstName = referredName.split(/\s+/)[0] || "friend";
    return (
      <div className="max-w-2xl mx-auto">
        <div
          className="card text-center"
          style={{
            background: "rgba(97,139,96,0.06)",
            border: "2px solid var(--ca-green)",
          }}
        >
          <h2 className="text-4xl mb-3">Got it, {firstName}.</h2>
          <p className="text-lg opacity-80 mb-4">
            A Christmas Air team member will reach out within one business day.
            If you need us sooner, call{" "}
            <a href="tel:4692142013" className="font-semibold">
              (469) 214-2013
            </a>
            .
          </p>

          <div
            className="mt-6 p-4 rounded-lg text-left"
            style={{ background: "var(--ca-cream)" }}
          >
            <p className="font-semibold text-sm uppercase tracking-wide opacity-70 mb-1">
              Your referral benefit
            </p>
            <p>{result.refereeDiscountLabel}</p>
            <p className="text-sm opacity-70 mt-1">
              No code needed — it&apos;s already on your account.
            </p>
          </div>

          {result.tripleWinCharityName && (
            <p className="mt-4 text-sm opacity-80">
              When your service is complete, we&apos;ll also donate to{" "}
              <strong>{result.tripleWinCharityName}</strong> in{" "}
              {referrerFirstName}&apos;s honor.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-2xl mx-auto">
      <div className="card">
        <h2 className="text-3xl mb-2">Tell us what you need.</h2>
        <p className="opacity-70 mb-6">
          We&apos;ll call or text within one business day. No pressure, no hard
          sell.
        </p>

        <Field label="Your name" required>
          <input
            className="input"
            required
            value={referredName}
            onChange={(e) => setReferredName(e.target.value)}
            autoComplete="name"
            placeholder="First and last"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Phone" required>
            <input
              className="input"
              type="tel"
              required
              value={referredPhone}
              onChange={(e) => setReferredPhone(e.target.value)}
              autoComplete="tel"
              placeholder="(469) 214-2013"
            />
          </Field>
          <Field label="Email (optional)">
            <input
              className="input"
              type="email"
              value={referredEmail}
              onChange={(e) => setReferredEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>
        </div>

        <Field label="Address (optional)">
          <input
            className="input"
            value={referredAddress}
            onChange={(e) => setReferredAddress(e.target.value)}
            autoComplete="street-address"
            placeholder="Speeds up scheduling"
          />
        </Field>

        <Field label="What do you need help with?" required>
          <div className="grid gap-2">
            {SERVICE_TYPES.map((opt) => (
              <label
                key={opt.value}
                className="flex items-start gap-3 p-3 rounded-lg cursor-pointer"
                style={{
                  border: `2px solid ${
                    serviceType === opt.value
                      ? "var(--ca-green)"
                      : "var(--border-subtle)"
                  }`,
                  background:
                    serviceType === opt.value
                      ? "rgba(97,139,96,0.06)"
                      : "var(--bg-card)",
                }}
              >
                <input
                  type="radio"
                  name="serviceType"
                  value={opt.value}
                  checked={serviceType === opt.value}
                  onChange={() => setServiceType(opt.value)}
                  className="mt-1"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="Anything else we should know? (optional)">
          <textarea
            className="input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Best time to reach you, specific concerns, etc."
          />
        </Field>

        {tripleWinCharityName && (
          <p
            className="text-sm opacity-80 mb-4 p-3 rounded-lg"
            style={{ background: "var(--ca-cream)" }}
          >
            By submitting, you&apos;re helping {referrerFirstName} trigger a
            donation to <strong>{tripleWinCharityName}</strong> when your service
            is complete.
          </p>
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

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={submitting}
          style={{ opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? "Sending…" : "Book my service"}
        </button>

        <p className="mt-4 text-center text-xs opacity-60">
          By submitting, you agree to be contacted by Christmas Air at the phone
          number and email provided.
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-semibold mb-2">
        {label}
        {required && (
          <span style={{ color: "var(--ca-red)" }} className="ml-0.5">
            *
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
