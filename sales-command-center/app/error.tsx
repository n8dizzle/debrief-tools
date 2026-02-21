'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="glass-card p-8 max-w-md text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Oops! Something went wrong
        </h1>
        <p className="text-muted-foreground mb-6">
          We encountered an unexpected error. Please try again or return to the dashboard.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/50 mb-6 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-lg bg-sage hover:bg-sage/90 text-white font-medium transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <a
            href="/"
            className="px-6 py-2.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
