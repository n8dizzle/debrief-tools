'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const supabase = createBrowserClient();

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setError('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-[var(--hw-border)] bg-white p-8 text-center shadow-sm dark:bg-[var(--hw-bg)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
          <svg
            className="h-7 w-7 text-green-600 dark:text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <h2 className="mt-5 text-xl font-bold text-[var(--hw-text)]">
          Check your email
        </h2>
        <p className="mt-2 text-sm text-[var(--hw-text-secondary)]">
          We sent a confirmation link to{' '}
          <span className="font-medium text-[var(--hw-text)]">{email}</span>.
          Click the link to activate your account.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-semibold text-primary hover:text-primary-dark"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--hw-border)] bg-white p-8 shadow-sm dark:bg-[var(--hw-bg)]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--hw-text)]">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-[var(--hw-text-secondary)]">
          Join Homework and find trusted home service pros
        </p>
      </div>

      {/* Google OAuth */}
      <div className="mt-8">
        <button
          type="button"
          onClick={handleGoogleSignup}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--hw-border)] bg-white px-4 py-3 text-sm font-medium text-[var(--hw-text)] shadow-sm transition-colors hover:bg-[var(--hw-bg-secondary)] dark:bg-[var(--hw-bg-secondary)]"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign up with Google
        </button>
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--hw-border)]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 text-[var(--hw-text-tertiary)] dark:bg-[var(--hw-bg)]">
            or sign up with email
          </span>
        </div>
      </div>

      {/* Signup Form */}
      <form onSubmit={handleEmailSignup} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-[var(--hw-text)]"
          >
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
            className="mt-1.5 block w-full rounded-xl border border-[var(--hw-border)] bg-white px-4 py-3 text-sm text-[var(--hw-text)] placeholder-[var(--hw-text-tertiary)] shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-[var(--hw-bg-secondary)]"
            placeholder="Jane Smith"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-[var(--hw-text)]"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="mt-1.5 block w-full rounded-xl border border-[var(--hw-border)] bg-white px-4 py-3 text-sm text-[var(--hw-text)] placeholder-[var(--hw-text-tertiary)] shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-[var(--hw-bg-secondary)]"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-[var(--hw-text)]"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
            className="mt-1.5 block w-full rounded-xl border border-[var(--hw-border)] bg-white px-4 py-3 text-sm text-[var(--hw-text)] placeholder-[var(--hw-text-tertiary)] shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:bg-[var(--hw-bg-secondary)]"
            placeholder="At least 8 characters"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>

        <p className="text-center text-xs text-[var(--hw-text-tertiary)]">
          By signing up, you agree to our{' '}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--hw-text-secondary)]">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-semibold text-primary hover:text-primary-dark"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
