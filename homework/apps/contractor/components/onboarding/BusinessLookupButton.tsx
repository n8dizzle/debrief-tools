'use client';

import { useState } from 'react';

interface LookupResult {
  found: boolean;
  business_name?: string;
  phone?: string;
  website?: string;
  rating?: number;
  review_count?: number;
  photo_url?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  ai_enrichment?: {
    description?: string;
    specialties?: string[];
    years_in_business?: number;
    team_size?: number;
    service_area?: string;
  };
  message?: string;
}

interface BusinessLookupButtonProps {
  businessName: string;
  onResult: (result: LookupResult) => void;
}

export default function BusinessLookupButton({ businessName, onResult }: BusinessLookupButtonProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'searching' | 'enriching' | 'done' | 'not_found'>('idle');

  async function handleLookup() {
    if (!businessName.trim()) return;

    setLoading(true);
    setStatus('searching');

    try {
      const res = await fetch('/api/onboarding/lookup-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName }),
      });

      const data: LookupResult = await res.json();

      if (data.found) {
        setStatus(data.ai_enrichment ? 'done' : 'done');
        onResult(data);
      } else {
        setStatus('not_found');
      }
    } catch {
      setStatus('not_found');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleLookup}
        disabled={loading || !businessName.trim()}
        className="btn-secondary"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          fontSize: '0.8125rem',
          opacity: loading || !businessName.trim() ? 0.6 : 1,
        }}
      >
        {loading ? (
          <>
            <span
              style={{
                width: '14px',
                height: '14px',
                border: '2px solid var(--border-default)',
                borderTopColor: 'var(--hw-blue)',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
              }}
            />
            {status === 'searching' ? 'Searching...' : 'Enriching with AI...'}
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            Look up my business
          </>
        )}
      </button>
      {status === 'not_found' && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
          No results found. Enter your details manually below.
        </p>
      )}
    </div>
  );
}
