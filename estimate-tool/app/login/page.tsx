'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

function LoginContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  useEffect(() => {
    if (session) {
      router.push('/');
    }
  }, [session, router]);

  return (
    <div className="max-w-md w-full">
      <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[var(--christmas-green)] flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">CA</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Estimate Tool</h1>
          <p className="text-gray-500 mt-2 text-sm">Sign in with your company Google account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              {error === 'AccessDenied'
                ? 'Access denied. Please use your company email.'
                : error === 'NotRegistered'
                ? "Your account hasn't been set up yet. Contact your manager."
                : error === 'AccountInactive'
                ? 'Your account has been deactivated. Contact your manager.'
                : 'An error occurred. Please try again.'
              }
            </p>
          </div>
        )}

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full flex items-center justify-center gap-3 rounded-lg px-6 py-3.5 font-medium bg-gray-50 border border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-all"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>

        <p className="mt-6 text-center text-xs text-gray-400">
          Only @christmasair.com accounts can access this tool.
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-gray-400">
        Christmas Air Conditioning &amp; Plumbing
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Suspense fallback={<div className="text-gray-400">Loading...</div>}>
        <LoginContent />
      </Suspense>
    </div>
  );
}
