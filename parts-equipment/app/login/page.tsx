'use client';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const errorMessages: Record<string, string> = {
    NotRegistered: 'Your account is not registered. Contact an admin.',
    AccountInactive: 'Your account has been deactivated. Contact an admin.',
    OAuthAccountNotLinked: 'This email is linked to a different sign-in method.',
    default: 'Sign in failed. Please try again.',
  };

  const errorMessage = error ? (errorMessages[error] || errorMessages.default) : null;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span style={{ fontSize: 32 }}>❄️</span>
        </div>
        <h1 className="login-title">Parts &amp; Equipment</h1>
        <p className="login-subtitle">Christmas Air Conditioning &amp; Plumbing</p>

        {errorMessage && (
          <div className="login-error">{errorMessage}</div>
        )}

        <button
          className="login-btn"
          onClick={() => signIn('google', { callbackUrl })}
        >
          <svg width="20" height="20" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
            <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
            <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
            <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/>
            <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
          </svg>
          Sign in with Google
        </button>

        <p className="login-footer">
          Only @christmasair.com accounts are allowed.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="login-page">
        <div className="login-card">
          <p style={{ color: 'var(--muted)', textAlign: 'center' }}>Loading...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
