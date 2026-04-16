"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function LoginContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    if (session) router.push("/admin");
  }, [session, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="card max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-4xl mb-2">Admin Sign-In</h1>
          <p className="opacity-70 text-sm">
            For Christmas Air staff managing the referral program.
          </p>
        </div>

        {error && (
          <div
            className="mb-6 p-4 rounded-lg text-sm"
            style={{
              background: "rgba(135, 76, 59, 0.1)",
              border: "1px solid var(--ca-red)",
              color: "var(--ca-red)",
            }}
          >
            {error === "NotRegistered" &&
              "Your account isn't set up yet. Contact your manager."}
            {error === "AccountInactive" &&
              "Your account is deactivated. Contact your manager."}
            {error === "AccessDenied" &&
              "Access denied. Use your company email."}
            {!["NotRegistered", "AccountInactive", "AccessDenied"].includes(
              error || ""
            ) && "Something went wrong. Try again."}
          </div>
        )}

        <button
          onClick={() => signIn("google", { callbackUrl: "/admin" })}
          className="btn btn-primary w-full"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-center text-xs opacity-60">
          Customer?{" "}
          <a href="/" className="font-semibold">
            Visit the referral program →
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginContent />
    </Suspense>
  );
}
