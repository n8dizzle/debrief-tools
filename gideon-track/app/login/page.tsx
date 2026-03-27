"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function LoginForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const [mode, setMode] = useState<"staff" | "parent">("staff");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [credError, setCredError] = useState("");

  useEffect(() => {
    if (session?.user) {
      const role = session.user.role;
      if (role === "admin") router.push("/admin");
      else if (role === "tutor") router.push("/tutor");
      else if (role === "parent") router.push("/parent");
      else router.push("/");
    }
  }, [session, router]);

  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setCredError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setCredError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/");
    }
  };

  const errorMessages: Record<string, string> = {
    AccessDenied: "Access denied. Your account is not set up for staff access.",
    CredentialsSignin: "Invalid email or password.",
    Default: "An error occurred. Please try again.",
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-[0.04]"
          style={{ background: 'var(--gideon-blue)' }}
        />
        <div
          className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full opacity-[0.03]"
          style={{ background: 'var(--gideon-red)' }}
        />
        <div
          className="absolute top-1/3 left-1/4 w-48 h-48 rounded-full opacity-[0.025]"
          style={{ background: 'var(--gideon-orange)' }}
        />
      </div>

      <div className="w-full max-w-md p-6 relative z-10 animate-fade-up">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{
              background: 'linear-gradient(135deg, var(--gideon-red) 0%, var(--gideon-orange) 100%)',
              boxShadow: '0 4px 16px rgba(217, 48, 37, 0.25)',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <h1
            className="text-3xl mb-1"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display), sans-serif',
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}
          >
            GideonTrack
          </h1>
          <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
            Building Confidence Through Academic Mastery
          </p>
        </div>

        {/* Error Banner */}
        {(error || credError) && (
          <div
            className="mb-4 p-3 rounded-xl text-sm flex items-center gap-2 animate-scale-in"
            style={{ background: 'var(--error-light)', color: '#B71C1C', border: '1px solid rgba(217, 48, 37, 0.15)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {credError || errorMessages[error || ""] || errorMessages.Default}
          </div>
        )}

        {/* Mode Toggle */}
        <div
          className="flex rounded-xl p-1 mb-6"
          style={{ background: 'var(--border-subtle)', border: '1px solid var(--border-default)' }}
        >
          <button
            onClick={() => setMode("staff")}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
            style={{
              background: mode === "staff" ? 'var(--bg-card)' : 'transparent',
              color: mode === "staff" ? 'var(--gideon-blue-dark)' : 'var(--text-muted)',
              boxShadow: mode === "staff" ? 'var(--shadow-sm)' : 'none',
            }}
          >
            Staff Login
          </button>
          <button
            onClick={() => setMode("parent")}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
            style={{
              background: mode === "parent" ? 'var(--bg-card)' : 'transparent',
              color: mode === "parent" ? 'var(--gideon-blue-dark)' : 'var(--text-muted)',
              boxShadow: mode === "parent" ? 'var(--shadow-sm)' : 'none',
            }}
          >
            Parent Login
          </button>
        </div>

        {/* Login Card */}
        <div className="card" style={{ boxShadow: 'var(--shadow-lg)' }}>
          {mode === "staff" ? (
            <div>
              <button
                onClick={() => signIn("google", { callbackUrl: "/" })}
                className="btn w-full py-3 flex items-center justify-center gap-3 mb-4 font-semibold"
                style={{
                  border: '1.5px solid var(--border-default)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  borderRadius: '0.75rem',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>or use email</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
              </div>
              <form onSubmit={handleParentLogin}>
                <div className="mb-3">
                  <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
                </div>
                <div className="mb-4">
                  <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
                </div>
                <button type="submit" className="btn btn-primary w-full py-2.5" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleParentLogin}>
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Email
                </label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="parent@example.com"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Password
                </label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full py-3"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}
        </div>

        {/* Footer tagline */}
        <p className="text-center mt-6 text-xs" style={{ color: 'var(--text-muted)' }}>
          Gideon Math & Reading Center
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
