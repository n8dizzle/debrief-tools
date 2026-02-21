"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

function LoginContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    if (session) {
      router.push("/");
    }
  }, [session, router]);

  return (
    <div className="relative max-w-md w-full">
      <div className="rounded-2xl p-8 shadow-2xl bg-[hsl(120,13%,20%)] border border-[hsl(120,10%,25%)]">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-xl flex items-center justify-center bg-[hsl(93,29%,43%)]">
              <svg className="w-12 h-12" fill="none" stroke="hsl(60,20%,93%)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[hsl(60,20%,93%)]">
            Sales Command Center
          </h1>
          <p className="mt-2 text-[hsl(60,8%,57%)]">
            Sign in with your company Google account
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-900/20 border border-red-800/40">
            <p className="text-sm text-red-300">
              {error === "AccessDenied"
                ? "Access denied. Please use your company email."
                : error === "NotRegistered"
                ? "Your account hasn't been set up yet. Contact your manager to request access."
                : error === "AccountInactive"
                ? "Your account has been deactivated. Contact your manager for help."
                : "An error occurred. Please try again."}
            </p>
          </div>
        )}

        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full flex items-center justify-center gap-3 rounded-lg px-6 py-3.5 font-medium transition-colors bg-[hsl(120,17%,14%)] border border-[hsl(120,10%,25%)] text-[hsl(60,20%,93%)] hover:bg-[hsl(120,13%,20%)] hover:border-[hsl(93,29%,43%)]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>

        <p className="mt-6 text-center text-xs text-[hsl(60,8%,57%)]">
          Only @christmasair.com accounts can access this system.
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-[hsl(60,8%,57%)]">
        Christmas Air Conditioning & Plumbing
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[hsl(120,17%,14%)]">
      <Suspense fallback={<div className="text-center text-[hsl(60,8%,57%)]">Loading...</div>}>
        <LoginContent />
      </Suspense>
    </div>
  );
}
