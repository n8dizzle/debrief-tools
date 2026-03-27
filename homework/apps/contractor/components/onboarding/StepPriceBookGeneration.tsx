'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SamplePrice {
  name: string;
  slug: string;
  price: number; // cents
}

interface GenerationSummary {
  total_services: number;
  total_categories: number;
  sample_prices: SamplePrice[];
}

interface StepPriceBookGenerationProps {
  onBack: () => void;
}

export default function StepPriceBookGeneration({ onBack }: StepPriceBookGenerationProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<'generating' | 'done' | 'error'>('generating');
  const [summary, setSummary] = useState<GenerationSummary | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Animate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 400);

    async function generate() {
      try {
        const res = await fetch('/api/onboarding/generate-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (cancelled) return;

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to generate prices');
        }

        const data = await res.json();
        clearInterval(interval);
        setProgress(100);
        setSummary(data.summary);
        setPhase('done');
      } catch (err) {
        if (cancelled) return;
        clearInterval(interval);
        setError(err instanceof Error ? err.message : 'Generation failed');
        setPhase('error');
      }
    }

    generate();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function formatPrice(cents: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
  }

  // Generating state
  if (phase === 'generating') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        {/* Animated icon */}
        <div style={{
          width: '64px', height: '64px', margin: '0 auto 1.5rem',
          borderRadius: '50%', background: 'var(--status-info-bg, #F0FAF8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'pulse 2s ease-in-out infinite',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--hw-blue)" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
          Building your personalized price book...
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 2rem' }}>
          Using DFW market data and your cost structure to generate competitive prices.
        </p>

        {/* Progress bar */}
        <div style={{
          width: '100%', maxWidth: '300px', margin: '0 auto',
          height: '6px', borderRadius: '3px', background: 'var(--border-default)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: '3px', background: 'var(--hw-blue)',
            width: `${Math.min(progress, 100)}%`,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>
    );
  }

  // Error state
  if (phase === 'error') {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <div style={{
          width: '48px', height: '48px', margin: '0 auto 1rem',
          borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="24" height="24" fill="none" stroke="var(--status-error)" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
          Something went wrong
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
          {error}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button type="button" className="btn-secondary" onClick={onBack} style={{ padding: '0.75rem 1.5rem' }}>
            Go Back
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => { setPhase('generating'); setProgress(0); setError(''); }}
            style={{ padding: '0.75rem 1.5rem' }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div style={{ textAlign: 'center', padding: '1rem' }}>
      <div style={{
        width: '56px', height: '56px', margin: '0 auto 1rem',
        borderRadius: '50%', background: 'rgba(22, 163, 74, 0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="28" height="28" fill="none" stroke="var(--status-success)" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
        Your price book is ready!
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
        We priced <strong>{summary?.total_services || 0} services</strong> across{' '}
        <strong>{summary?.total_categories || 0} categories</strong> for you.
      </p>

      {/* Sample prices */}
      {summary?.sample_prices && summary.sample_prices.length > 0 && (
        <div style={{
          textAlign: 'left',
          background: 'var(--bg-input)',
          borderRadius: '10px',
          border: '1px solid var(--border-default)',
          overflow: 'hidden',
          marginBottom: '1.5rem',
        }}>
          <div style={{
            padding: '0.75rem 1rem',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-default)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>Sample Services</span>
            <span>Suggested Price</span>
          </div>
          {summary.sample_prices.map((sp) => (
            <div
              key={sp.slug}
              style={{
                padding: '0.625rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--border-light)',
                fontSize: '0.8125rem',
              }}
            >
              <span style={{ color: 'var(--text-primary)' }}>{sp.name}</span>
              <span style={{ fontWeight: 600, color: 'var(--hw-blue)' }}>{formatPrice(sp.price)}</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0 0 1.5rem' }}>
        You can adjust all prices from your Price Book page.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => router.push('/dashboard/pricebook')}
          style={{ flex: 1, padding: '0.75rem' }}
        >
          Review Price Book
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => { router.push('/dashboard'); router.refresh(); }}
          style={{ flex: 2, padding: '0.75rem', fontSize: '0.9375rem' }}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
