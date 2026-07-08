"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Phase = "loading" | "training" | "submitting" | "done" | "notoken";

export default function SpikeTrainingClient() {
  const token = useSearchParams().get("t");
  const [phase, setPhase] = useState<Phase>("loading");
  const tappedRef = useRef(false);

  // Log the tap exactly once on mount (fire-and-forget; the page still works if it fails).
  useEffect(() => {
    if (!token) {
      setPhase("notoken");
      return;
    }
    if (tappedRef.current) return;
    tappedRef.current = true;
    fetch("/api/spike/tap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      keepalive: true,
    }).finally(() => setPhase("training"));
  }, [token]);

  async function markComplete() {
    if (!token) return;
    setPhase("submitting");
    try {
      const res = await fetch("/api/spike/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setPhase(res.ok ? "done" : "training");
    } catch {
      setPhase("training");
    }
  }

  const card: React.CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-subtle)",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 480,
  };

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={card}>
        {phase === "notoken" && (
          <p style={{ color: "var(--status-error)", fontSize: 15 }}>
            This training link is missing its code. Please use the link we texted you.
          </p>
        )}

        {phase === "loading" && (
          <p style={{ color: "var(--text-secondary)" }}>Loading your training…</p>
        )}

        {(phase === "training" || phase === "submitting") && (
          <>
            <div style={{ fontSize: 13, color: "var(--christmas-green-light)", fontWeight: 700, letterSpacing: 0.4 }}>
              CHRISTMAS AIR TRAINING
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "8px 0 16px" }}>
              Quick Test: You&apos;re In 👋
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 16, lineHeight: 1.55 }}>
              This is a 30-second test of our new phone-based training. No app, no
              password. When you&apos;re done reading this, tap the button below so we
              know it reached you.
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: 16, lineHeight: 1.55, marginTop: 12 }}>
              Real trainings will be short videos, docs, and quick quizzes you can do
              right here on your phone between jobs.
            </p>
            <button
              onClick={markComplete}
              disabled={phase === "submitting"}
              style={{
                marginTop: 24,
                width: "100%",
                padding: "16px",
                borderRadius: 12,
                border: "none",
                background: "var(--christmas-green)",
                color: "var(--christmas-cream)",
                fontWeight: 700,
                fontSize: 17,
                cursor: phase === "submitting" ? "default" : "pointer",
                opacity: phase === "submitting" ? 0.7 : 1,
              }}
            >
              {phase === "submitting" ? "Saving…" : "Mark Complete ✓"}
            </button>
          </>
        )}

        {phase === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "12px 0 8px" }}>All done!</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 16 }}>
              Thanks. That&apos;s exactly how training will work from now on.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
