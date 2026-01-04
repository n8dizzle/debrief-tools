"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import Image from "next/image";

export default function LoginPage() {
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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Background decoration */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ opacity: 0.03 }}
      >
        <div
          className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 rounded-full"
          style={{ background: 'var(--christmas-green)' }}
        />
        <div
          className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 rounded-full"
          style={{ background: 'var(--christmas-green)' }}
        />
      </div>

      <div className="relative max-w-md w-full">
        <div
          className="rounded-2xl p-8 shadow-2xl"
          style={{
            background: 'var(--bg-secondary)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--border-subtle)'
          }}
        >
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image
                src="/logo.png"
                alt="Christmas Air Conditioning & Plumbing"
                width={120}
                height={120}
                className="h-24 w-auto"
              />
            </div>
            <h1
              className="text-2xl font-bold"
              style={{ color: 'var(--christmas-cream)' }}
            >
              Internal Tools
            </h1>
            <p
              className="mt-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Sign in with your company Google account
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="mb-6 p-4 rounded-lg"
              style={{
                background: 'rgba(139, 45, 50, 0.15)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--christmas-brown)'
              }}
            >
              <p
                className="text-sm"
                style={{ color: 'var(--christmas-brown-light)' }}
              >
                {error === "AccessDenied"
                  ? "Access denied. Please use your @christmasair.com email."
                  : "An error occurred. Please try again."
                }
              </p>
            </div>
          )}

          {/* Sign In Button */}
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="w-full flex items-center justify-center gap-3 rounded-lg px-6 py-3.5 font-medium transition-all duration-200"
            style={{
              background: 'var(--bg-card)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--border-default)',
              color: 'var(--christmas-cream)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--bg-card-hover)';
              e.currentTarget.style.borderColor = 'var(--christmas-green-dark)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--bg-card)';
              e.currentTarget.style.borderColor = 'var(--border-default)';
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>

          {/* Footer */}
          <p
            className="mt-6 text-center text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Only @christmasair.com accounts can access this portal.
          </p>
        </div>

        {/* Bottom branding */}
        <p
          className="mt-6 text-center text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          Christmas Air Conditioning & Plumbing
        </p>
      </div>
    </div>
  );
}
