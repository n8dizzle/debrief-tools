"use client";

import { useState } from "react";

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/customer/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) {
        setError("Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="card text-center">
        <h2 className="text-2xl mb-2">Check your email.</h2>
        <p className="opacity-80">
          If there&apos;s an account for <strong>{email}</strong>, we just sent a sign-in link.
          It expires in 15 minutes.
        </p>
        <p className="mt-6 text-sm opacity-60">
          Didn&apos;t get it?{" "}
          <button
            className="underline font-semibold"
            onClick={() => {
              setSent(false);
              setError(null);
            }}
          >
            Try again
          </button>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card">
      <label className="block mb-4">
        <span className="block text-sm font-semibold mb-2">Email</span>
        <input
          className="input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
        />
      </label>

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
        {submitting ? "Sending…" : "Send me a link"}
      </button>

      <p className="mt-6 text-center text-sm opacity-70">
        New here?{" "}
        <a href="/enroll" className="font-semibold">
          Join the program →
        </a>
      </p>
    </form>
  );
}
