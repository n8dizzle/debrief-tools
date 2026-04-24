"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

type ServiceType =
  | "HVAC"
  | "PLUMBING"
  | "WATER_HEATER"
  | "COMMERCIAL"
  | "NOT_SURE";

const SERVICE_TYPES: { value: ServiceType; label: string; soft?: boolean }[] = [
  { value: "HVAC", label: "Something's not right with my HVAC" },
  { value: "PLUMBING", label: "A plumbing issue (leak, drain, fixture, etc.)" },
  { value: "WATER_HEATER", label: "Water heater trouble or replacement" },
  { value: "COMMERCIAL", label: "Commercial property or business" },
  { value: "NOT_SURE", label: "Not sure yet — I just have a question", soft: true },
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
      setError("Let us know what's going on so we can route this to the right person.");
      return;
    }
    const phoneTrim = referredPhone.trim();
    const emailTrim = referredEmail.trim();
    if (!phoneTrim && !emailTrim) {
      setError("We need either a phone number or an email so we can reach out.");
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
          referredPhone: phoneTrim || null,
          referredEmail: emailTrim || null,
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
      trackEvent("referral_submitted", {
        referral_code: referralCode,
        service_type: serviceType,
        triple_win: !!data.tripleWinCharityName,
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
              Your thank-you
            </p>
            <p>{result.refereeDiscountLabel}</p>
            <p className="text-sm opacity-70 mt-1">
              We&apos;ll email it to you after your service is complete and
              paid. You pick the brand at redemption — Amazon, Target, Visa,
              and many more.
            </p>
          </div>

          {result.tripleWinCharityName && (
            <p className="mt-4 text-sm opacity-80">
              At the same time, we&apos;ll donate to{" "}
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
        <h2 className="text-3xl mb-2">How can we help?</h2>
        <p className="opacity-70 mb-6">
          Tell us as much or as little as you want. We&apos;ll reach out within
          one business day.
        </p>

        {/* Exit ramp for folks who'd rather pick up the phone than fill out a
            form. Matches the "no pressure" tone of the page header. */}
        <div
          className="mb-6 p-4 rounded-lg text-sm"
          style={{
            background: "rgba(97,139,96,0.08)",
            borderLeft: "3px solid var(--ca-green)",
          }}
        >
          Prefer to just call? Dial{" "}
          <a
            href="tel:4692142013"
            className="font-semibold"
            style={{ color: "var(--ca-dark-green)" }}
          >
            (469) 214-2013
          </a>{" "}
          and tell us {referrerFirstName} sent you.
        </div>

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

        {/* Phone OR email — either works, both welcome. Validation is handled
            both client-side (submit handler above) and server-side (Zod refine). */}
        <div className="mb-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="block text-sm font-semibold">
              How should we reach you?
              <span style={{ color: "var(--ca-red)" }} className="ml-0.5">
                *
              </span>
            </span>
            <span className="text-xs opacity-60">(pick one or both)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="sr-only">Phone</span>
              <input
                className="input"
                type="tel"
                value={referredPhone}
                onChange={(e) => setReferredPhone(e.target.value)}
                autoComplete="tel"
                placeholder="Phone — (469) 214-2013"
              />
            </label>
            <label className="block">
              <span className="sr-only">Email</span>
              <input
                className="input"
                type="email"
                value={referredEmail}
                onChange={(e) => setReferredEmail(e.target.value)}
                autoComplete="email"
                placeholder="Email — you@example.com"
              />
            </label>
          </div>
          <p className="text-xs opacity-60 mt-2">
            We only need one. We&apos;ll use whichever you prefer.
          </p>
        </div>

        <Field label="What's going on?" required>
          <div className="grid gap-2">
            {SERVICE_TYPES.map((opt) => {
              const selected = serviceType === opt.value;
              return (
                <label
                  key={opt.value}
                  className="flex items-start gap-3 p-3 rounded-lg cursor-pointer"
                  style={{
                    border: opt.soft
                      ? `2px dashed ${selected ? "var(--ca-green)" : "var(--border-subtle)"}`
                      : `2px solid ${selected ? "var(--ca-green)" : "var(--border-subtle)"}`,
                    background: selected
                      ? "rgba(97,139,96,0.06)"
                      : "var(--bg-card)",
                  }}
                >
                  <input
                    type="radio"
                    name="serviceType"
                    value={opt.value}
                    checked={selected}
                    onChange={() => setServiceType(opt.value)}
                    className="mt-1"
                  />
                  <span
                    style={{
                      fontStyle: opt.soft ? "italic" : "normal",
                      opacity: opt.soft && !selected ? 0.75 : 1,
                    }}
                  >
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </div>
        </Field>

        <Field
          label={
            <>
              Tell us the story{" "}
              <span className="font-normal opacity-60">(optional)</span>
            </>
          }
        >
          <textarea
            className="input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What's happening, when it started, best time to reach you — whatever's helpful."
          />
        </Field>

        {tripleWinCharityName && (
          <p
            className="text-sm opacity-80 mb-4 p-3 rounded-lg"
            style={{ background: "var(--ca-cream)" }}
          >
            By getting in touch, you&apos;re helping {referrerFirstName} trigger
            a donation to <strong>{tripleWinCharityName}</strong> once your
            service is complete. No cost to you.
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
          {submitting ? "Sending…" : "Have someone reach out"}
        </button>

        <p className="mt-4 text-center text-xs opacity-60">
          By submitting, you agree to be contacted by Christmas Air at the phone
          number or email provided.
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
  label: React.ReactNode;
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
