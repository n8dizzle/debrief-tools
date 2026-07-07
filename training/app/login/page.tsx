"use client";

import { signIn } from "next-auth/react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function LoginInner() {
  const params = useSearchParams();
  const error = params.get("error");
  const messages: Record<string, string> = {
    NotRegistered: "That account isn't set up in the portal yet. Ask an admin to add you.",
    AccountInactive: "That account is inactive.",
    AccessDenied: "Only christmasair.com accounts can sign in.",
  };
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          padding: 32,
          width: "100%",
          maxWidth: 380,
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          Christmas Air Training
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: 14 }}>
          Manager sign-in
        </p>
        {error && (
          <p style={{ color: "var(--status-error)", marginBottom: 16, fontSize: 13 }}>
            {messages[error] || "Sign-in failed. Try again."}
          </p>
        )}
        <button
          onClick={() => signIn("google", { callbackUrl: "/admin" })}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            background: "var(--christmas-green)",
            color: "var(--christmas-cream)",
            fontWeight: 600,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
