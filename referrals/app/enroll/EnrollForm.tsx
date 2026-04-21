"use client";

import { useEffect, useState } from "react";
import type { Charity } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";

type Step = "contact" | "reward" | "charity" | "done";

type RewardPref =
  | "VISA_GIFT_CARD"
  | "AMAZON_GIFT_CARD"
  | "ACCOUNT_CREDIT"
  | "CHARITY_DONATION";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  rewardPreference: RewardPref;
  selectedCharityId: string | null;
}

const initialState: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  rewardPreference: "VISA_GIFT_CARD",
  selectedCharityId: null,
};

interface EnrollFormProps {
  charities: Charity[];
  tripleWinEnabled: boolean;
}

export default function EnrollForm({
  charities,
  tripleWinEnabled,
}: EnrollFormProps) {
  const [step, setStep] = useState<Step>("contact");
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    referralCode: string;
    referralLink: string;
    tripleWinEnabled: boolean;
    alreadyEnrolled?: boolean;
  } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        const hint =
          res.status >= 500
            ? "Something went wrong on our end. Please try again, or call (469) 214-2013 and we'll enroll you by hand."
            : data.error || "Please check the info above and try again.";
        setError(hint);
        setSubmitting(false);
        return;
      }
      setResult(data);
      setStep("done");
      trackEvent("enrollment_completed", {
        triple_win: tripleWinEnabled && !!form.selectedCharityId,
        already_enrolled: !!data.alreadyEnrolled,
        reward_preference: form.rewardPreference,
      });
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done" && result) {
    return (
      <DoneScreen
        result={result}
        tripleWinEnabled={tripleWinEnabled && !!form.selectedCharityId}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <ProgressIndicator step={step} tripleWinEnabled={tripleWinEnabled} />

      {step === "contact" && (
        <ContactStep
          form={form}
          update={update}
          onNext={() => {
            if (!form.firstName || !form.lastName || !form.email || !form.phone) {
              setError("Please fill in all fields");
              return;
            }
            setError(null);
            setStep("reward");
          }}
          error={error}
        />
      )}

      {step === "reward" && (
        <RewardStep
          form={form}
          update={update}
          onBack={() => setStep("contact")}
          onNext={() => {
            if (tripleWinEnabled) {
              setStep("charity");
            } else {
              submit();
            }
          }}
          submitting={submitting}
          submitLabel={tripleWinEnabled ? "Continue →" : "Finish enrollment"}
        />
      )}

      {step === "charity" && (
        <CharityStep
          form={form}
          update={update}
          charities={charities}
          onBack={() => setStep("reward")}
          onSubmit={submit}
          submitting={submitting}
          error={error}
        />
      )}
    </div>
  );
}

function ProgressIndicator({
  step,
  tripleWinEnabled,
}: {
  step: Step;
  tripleWinEnabled: boolean;
}) {
  const steps: { id: Step; label: string }[] = [
    { id: "contact", label: "About you" },
    { id: "reward", label: "Reward format" },
    ...(tripleWinEnabled
      ? ([{ id: "charity", label: "Your charity" }] as const)
      : []),
  ];
  const activeIdx = steps.findIndex((s) => s.id === step);

  return (
    <div className="flex items-center justify-between mb-10 max-w-md mx-auto text-sm">
      {steps.map((s, i) => {
        const active = i === activeIdx;
        const done = i < activeIdx;
        return (
          <div key={s.id} className="flex items-center flex-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-semibold transition-colors"
              style={{
                background: active || done ? "var(--ca-green)" : "transparent",
                border: "2px solid var(--ca-green)",
                color: active || done ? "var(--ca-cream)" : "var(--ca-green)",
              }}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className="flex-1 h-0.5 mx-2"
                style={{
                  background: done ? "var(--ca-green)" : "var(--border-subtle)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ContactStep({
  form,
  update,
  onNext,
  error,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onNext: () => void;
  error: string | null;
}) {
  return (
    <div className="card">
      <h2 className="text-3xl mb-2">Who are you?</h2>
      <p className="opacity-70 mb-6">
        We&apos;ll match you to your Christmas Air account automatically.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Field label="First name">
          <input
            className="input"
            value={form.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            autoComplete="given-name"
          />
        </Field>
        <Field label="Last name">
          <input
            className="input"
            value={form.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            autoComplete="family-name"
          />
        </Field>
      </div>

      <Field label="Email">
        <input
          className="input"
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          autoComplete="email"
        />
      </Field>

      <Field label="Phone">
        <input
          className="input"
          type="tel"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          autoComplete="tel"
          placeholder="(469) 214-2013"
        />
      </Field>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      <div className="flex justify-end mt-6">
        <button className="btn btn-primary" onClick={onNext}>
          Continue →
        </button>
      </div>
    </div>
  );
}

function RewardStep({
  form,
  update,
  onBack,
  onNext,
  submitting,
  submitLabel,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onBack: () => void;
  onNext: () => void;
  submitting: boolean;
  submitLabel: string;
}) {
  const options: { value: RewardPref; label: string; desc: string }[] = [
    { value: "VISA_GIFT_CARD", label: "Visa gift card", desc: "Use it anywhere." },
    { value: "AMAZON_GIFT_CARD", label: "Amazon credit", desc: "Delivered instantly." },
    { value: "ACCOUNT_CREDIT", label: "Account credit", desc: "Applied to your next service." },
    { value: "CHARITY_DONATION", label: "All to charity", desc: "Skip the reward, send it to your cause." },
  ];

  return (
    <div className="card">
      <h2 className="text-3xl mb-2">How should we say thanks?</h2>
      <p className="opacity-70 mb-6">
        You can change this any time in your dashboard.
      </p>

      <div className="space-y-3 mb-6">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors"
            style={{
              border: `2px solid ${
                form.rewardPreference === o.value
                  ? "var(--ca-green)"
                  : "var(--border-subtle)"
              }`,
              background:
                form.rewardPreference === o.value
                  ? "rgba(97,139,96,0.06)"
                  : "var(--bg-card)",
            }}
          >
            <input
              type="radio"
              name="rewardPreference"
              value={o.value}
              checked={form.rewardPreference === o.value}
              onChange={() => update("rewardPreference", o.value)}
              className="mt-1"
            />
            <div>
              <p className="font-semibold">{o.label}</p>
              <p className="text-sm opacity-70">{o.desc}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="flex justify-between">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={submitting}
          style={{
            opacity: submitting ? 0.6 : 1,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Enrolling…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

function CharityStep({
  form,
  update,
  charities,
  onBack,
  onSubmit,
  submitting,
  error,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  charities: Charity[];
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const canSubmit = !!form.selectedCharityId;

  return (
    <div className="card">
      <h2 className="text-3xl mb-2">Pick the cause you&apos;d like to support.</h2>
      <p className="opacity-80 mb-6">
        Every successful referral from you also triggers a matched donation from
        Christmas Air to the charity you pick.{" "}
        <strong>You keep your full reward.</strong> This is a bonus — not a swap.
      </p>

      <div className="mb-6">
        <div className="grid gap-3">
          {charities.map((c) => (
            <label
              key={c.id}
              className="flex items-start gap-3 p-4 rounded-lg cursor-pointer"
              style={{
                border: `2px solid ${
                  form.selectedCharityId === c.id
                    ? "var(--ca-green)"
                    : "var(--border-subtle)"
                }`,
                background:
                  form.selectedCharityId === c.id
                    ? "rgba(97,139,96,0.06)"
                    : "var(--bg-card)",
              }}
            >
              <input
                type="radio"
                name="selectedCharityId"
                value={c.id}
                checked={form.selectedCharityId === c.id}
                onChange={() => update("selectedCharityId", c.id)}
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
          You can change your charity any time from your dashboard.
        </p>
      </div>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      <div className="flex justify-between mt-6">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <button
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          style={{
            opacity: !canSubmit || submitting ? 0.6 : 1,
            cursor: !canSubmit || submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Enrolling…" : "Finish enrollment"}
        </button>
      </div>
    </div>
  );
}

function DoneScreen({
  result,
  tripleWinEnabled,
}: {
  result: {
    referralCode: string;
    referralLink: string;
    tripleWinEnabled: boolean;
    alreadyEnrolled?: boolean;
  };
  tripleWinEnabled: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(result.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card text-center">
        {result.alreadyEnrolled ? (
          <>
            <h2 className="text-3xl mb-2">Welcome back.</h2>
            <p className="opacity-80 mb-6">
              You&apos;re already enrolled. Here&apos;s your link:
            </p>
          </>
        ) : (
          <>
            <h2 className="text-3xl mb-2">You&apos;re in.</h2>
            <p className="opacity-80 mb-6">
              {tripleWinEnabled
                ? "Triple Win is on — your referrals now support your charity. We sent a welcome email to your inbox."
                : "We sent a welcome email to your inbox."}
            </p>
          </>
        )}

        <div
          className="p-4 rounded-lg mb-4 font-mono text-sm break-all"
          style={{ background: "var(--ca-cream)" }}
        >
          {result.referralLink}
        </div>

        <button className="btn btn-primary" onClick={copy}>
          {copied ? "Copied!" : "Copy link"}
        </button>

        <p className="mt-6 text-sm opacity-60">
          Check your email for a one-click link to your dashboard.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-semibold mb-2">{label}</span>
      {children}
    </label>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mt-4 p-3 rounded-lg text-sm"
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
