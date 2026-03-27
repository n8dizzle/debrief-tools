'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';

interface Department {
  id: string;
  name: string;
  slug: string;
  description: string;
}

// Common DFW zip codes
const DFW_ZIP_CODES = [
  '75001', '75002', '75006', '75007', '75009', '75010', '75013', '75019', '75023', '75024',
  '75025', '75028', '75034', '75035', '75038', '75039', '75040', '75041', '75042', '75043',
  '75044', '75048', '75050', '75051', '75052', '75054', '75056', '75057', '75060', '75061',
  '75062', '75063', '75065', '75067', '75068', '75069', '75070', '75071', '75074', '75075',
  '75077', '75078', '75080', '75081', '75082', '75083', '75087', '75088', '75089', '75093',
  '75094', '75098', '75104', '75115', '75116', '75134', '75137', '75141', '75142', '75143',
  '75146', '75149', '75150', '75154', '75159', '75160', '75166', '75167', '75172', '75180',
  '75181', '75182', '75189', '75201', '75202', '75203', '75204', '75205', '75206', '75207',
  '75208', '75209', '75210', '75211', '75212', '75214', '75215', '75216', '75217', '75218',
  '75219', '75220', '75223', '75224', '75225', '75226', '75227', '75228', '75229', '75230',
  '75231', '75232', '75233', '75234', '75235', '75236', '75237', '75238', '75240', '75241',
  '75243', '75244', '75246', '75247', '75248', '75249', '75251', '75252', '75253', '75254',
  '75270', '75287', '76001', '76002', '76006', '76010', '76011', '76012', '76013', '76014',
  '76015', '76016', '76017', '76018', '76020', '76021', '76022', '76028', '76034', '76039',
  '76040', '76051', '76052', '76053', '76054', '76060', '76063', '76065', '76092', '76109',
  '76111', '76112', '76116', '76117', '76118', '76119', '76120', '76126', '76127', '76131',
  '76132', '76133', '76134', '76135', '76137', '76140', '76148', '76155', '76177', '76180',
  '76182', '76201', '76205', '76207', '76208', '76209', '76210', '76226', '76227', '76234',
  '76244', '76247', '76248', '76249', '76258', '76262',
];

export default function SignupPage() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2: Business info
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');

  // Step 3: Trades
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);

  // Step 4: Service areas
  const [allDfw, setAllDfw] = useState(true);
  const [selectedZips, setSelectedZips] = useState<string[]>([]);
  const [zipSearch, setZipSearch] = useState('');

  // Step 1 success (email confirmation needed)
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  // Step 1 success (auto-confirmed, move to step 2)
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  // Load departments for step 3
  useEffect(() => {
    if (step === 3 && departments.length === 0) {
      setLoadingDepts(true);
      fetch('/api/catalog')
        .then((res) => res.json())
        .then((data) => {
          setDepartments(data.departments || []);
        })
        .catch(() => {})
        .finally(() => setLoadingDepts(false));
    }
  }, [step, departments.length]);

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: 'contractor',
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=/onboarding`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Check if email confirmation is required
    if (data.user && data.session) {
      // Auto-confirmed, redirect to onboarding wizard
      router.push('/onboarding');
      router.refresh();
      return;
    } else if (data.user && !data.session) {
      // Needs email confirmation
      setNeedsConfirmation(true);
    }

    setLoading(false);
  }

  function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!businessName.trim() || !ownerName.trim()) {
      setError('Business name and owner name are required');
      return;
    }

    setStep(3);
  }

  function handleStep3() {
    setError('');
    if (selectedTrades.length === 0) {
      setError('Select at least one trade');
      return;
    }
    setStep(4);
  }

  function toggleTrade(deptId: string) {
    setSelectedTrades((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  }

  function toggleZip(zip: string) {
    setSelectedZips((prev) =>
      prev.includes(zip) ? prev.filter((z) => z !== zip) : [...prev, zip]
    );
  }

  async function handleSubmit() {
    setError('');
    setLoading(true);

    try {
      const zipCodes = allDfw ? DFW_ZIP_CODES : selectedZips;

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName,
          owner_name: ownerName,
          phone: phone || null,
          trade_ids: selectedTrades,
          zip_codes: zipCodes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to complete onboarding');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete signup');
    } finally {
      setLoading(false);
    }
  }

  const filteredZips = zipSearch
    ? DFW_ZIP_CODES.filter((z) => z.startsWith(zipSearch))
    : DFW_ZIP_CODES;

  // Email confirmation screen
  if (needsConfirmation) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--status-success-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}
        >
          <svg width="24" height="24" fill="none" stroke="var(--status-success)" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
          Check your email
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
          We sent a confirmation link to <strong>{email}</strong>.
          Click the link to activate your account, then sign in to complete setup.
        </p>
        <Link href="/login" className="btn-secondary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '2rem' }}>
      {/* Step indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            style={{
              width: '40px',
              height: '4px',
              borderRadius: '2px',
              background: s <= step ? 'var(--hw-blue)' : 'var(--border-default)',
              transition: 'background 0.2s ease',
            }}
          />
        ))}
      </div>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.375rem' }}>
        {step === 1 && 'Create your account'}
        {step === 2 && 'Business information'}
        {step === 3 && 'Select your trades'}
        {step === 4 && 'Service areas'}
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
        {step === 1 && 'Step 1 of 4 - Set up your login credentials.'}
        {step === 2 && 'Step 2 of 4 - Tell us about your business.'}
        {step === 3 && 'Step 3 of 4 - What trades do you offer?'}
        {step === 4 && 'Step 4 of 4 - Where do you serve?'}
      </p>

      {error && (
        <div
          style={{
            background: 'var(--status-error-bg)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            color: 'var(--status-error)',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Step 1: Auth */}
      {step === 1 && (
        <form onSubmit={handleStep1}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="email" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
              Email Address *
            </label>
            <input id="email" type="email" className="input" placeholder="john@abcplumbing.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label htmlFor="password" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                Password *
              </label>
              <input id="password" type="password" className="input" placeholder="Min 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            <div>
              <label htmlFor="confirmPassword" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                Confirm Password *
              </label>
              <input id="confirmPassword" type="password" className="input" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '0.75rem', fontSize: '0.9375rem' }}>
            {loading ? 'Creating Account...' : 'Continue'}
          </button>
        </form>
      )}

      {/* Step 2: Business Info */}
      {step === 2 && (
        <form onSubmit={handleStep2}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label htmlFor="businessName" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                Business Name *
              </label>
              <input id="businessName" type="text" className="input" placeholder="ABC Plumbing" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="ownerName" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                Your Name *
              </label>
              <input id="ownerName" type="text" className="input" placeholder="John Smith" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="phone" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
              Phone Number
            </label>
            <input id="phone" type="tel" className="input" placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn-secondary" onClick={() => setStep(1)} style={{ flex: 1, padding: '0.75rem' }}>
              Back
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 2, padding: '0.75rem', fontSize: '0.9375rem' }}>
              Continue
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Trades */}
      {step === 3 && (
        <div>
          {loadingDepts ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading trades...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {departments.map((dept) => {
                const isSelected = selectedTrades.includes(dept.id);
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => toggleTrade(dept.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem',
                      background: isSelected ? 'var(--status-info-bg)' : 'var(--bg-input)',
                      border: `2px solid ${isSelected ? 'var(--hw-blue)' : 'var(--border-default)'}`,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      color: 'var(--text-primary)',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        border: `2px solid ${isSelected ? 'var(--hw-blue)' : 'var(--border-default)'}`,
                        background: isSelected ? 'var(--hw-blue)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && (
                        <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{dept.name}</div>
                      {dept.description && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                          {dept.description}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}

              {departments.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No departments found. You can add trades later.
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn-secondary" onClick={() => setStep(2)} style={{ flex: 1, padding: '0.75rem' }}>
              Back
            </button>
            <button type="button" className="btn-primary" onClick={handleStep3} style={{ flex: 2, padding: '0.75rem', fontSize: '0.9375rem' }}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Service Areas */}
      {step === 4 && (
        <div>
          {/* All DFW Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem',
              background: allDfw ? 'var(--status-info-bg)' : 'var(--bg-input)',
              border: `2px solid ${allDfw ? 'var(--hw-blue)' : 'var(--border-default)'}`,
              borderRadius: '10px',
              marginBottom: '1rem',
              cursor: 'pointer',
            }}
            onClick={() => setAllDfw(!allDfw)}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                border: `2px solid ${allDfw ? 'var(--hw-blue)' : 'var(--border-default)'}`,
                background: allDfw ? 'var(--hw-blue)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {allDfw && (
                <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                All DFW Metroplex
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Serve the entire Dallas-Fort Worth area ({DFW_ZIP_CODES.length} zip codes)
              </div>
            </div>
          </div>

          {!allDfw && (
            <>
              <div style={{ marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Search zip codes..."
                  value={zipSearch}
                  onChange={(e) => setZipSearch(e.target.value)}
                />
              </div>

              <div
                style={{
                  maxHeight: '240px',
                  overflowY: 'auto',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.375rem',
                  marginBottom: '1rem',
                  padding: '0.5rem',
                  background: 'var(--bg-input)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                }}
              >
                {filteredZips.map((zip) => {
                  const isSelected = selectedZips.includes(zip);
                  return (
                    <button
                      key={zip}
                      type="button"
                      onClick={() => toggleZip(zip)}
                      style={{
                        padding: '0.375rem 0.5rem',
                        borderRadius: '6px',
                        border: `1px solid ${isSelected ? 'var(--hw-blue)' : 'transparent'}`,
                        background: isSelected ? 'var(--status-info-bg)' : 'transparent',
                        color: isSelected ? 'var(--hw-blue-light)' : 'var(--text-secondary)',
                        fontSize: '0.8125rem',
                        fontWeight: isSelected ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.1s ease',
                      }}
                    >
                      {zip}
                    </button>
                  );
                })}
              </div>

              {selectedZips.length > 0 && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  {selectedZips.length} zip code{selectedZips.length !== 1 ? 's' : ''} selected
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={() => setStep(3)} style={{ flex: 1, padding: '0.75rem' }}>
              Back
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSubmit}
              disabled={loading || (!allDfw && selectedZips.length === 0)}
              style={{ flex: 2, padding: '0.75rem', fontSize: '0.9375rem' }}
            >
              {loading ? 'Creating Profile...' : 'Complete Setup'}
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--hw-blue-light)', textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
