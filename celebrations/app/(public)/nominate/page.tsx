'use client';

import { useState, useEffect } from 'react';
import { CelNominationPeriod } from '@/lib/supabase';
import VoiceNominate from '@/components/VoiceNominate';

export default function PublicNominatePage() {
  const [period, setPeriod] = useState<CelNominationPeriod | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [nomineeName, setNomineeName] = useState('');
  const [nominatorName, setNominatorName] = useState('');
  const [companyValue, setCompanyValue] = useState('');
  const [story, setStory] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchPeriod();
  }, []);

  async function fetchPeriod() {
    try {
      const res = await fetch('/api/nominate');
      if (res.ok) {
        const data = await res.json();
        setPeriod(data.period);
      }
    } catch (err) {
      console.error('Failed to fetch period:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!period || !nomineeName.trim() || !nominatorName.trim() || !companyValue || !story.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/nominate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_id: period.id,
          nominee_name: nomineeName.trim(),
          nominator_name: nominatorName.trim(),
          company_value: companyValue,
          story: story.trim(),
          event_date: eventDate || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit nomination');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setNomineeName('');
    setCompanyValue('');
    setStory('');
    setEventDate('');
    setError('');
    setSubmitted(false);
    // Keep nominator name for convenience
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--christmas-green)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!period) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🏆</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--christmas-cream)' }}>
          No Open Nominations
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          There are no nomination periods currently accepting submissions. Check back soon!
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🏆</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--christmas-cream)' }}>
          Nomination Submitted!
        </h2>
        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
          Thank you for recognizing a teammate. Your nomination for <strong style={{ color: 'var(--christmas-cream)' }}>{nomineeName}</strong> has been recorded.
        </p>
        <button onClick={handleReset} className="btn btn-primary">
          Submit Another Nomination
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 sm:py-8 pb-8">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🏆</div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Value Champion Nomination
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {period.title}
        </p>
        {period.description && (
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            {period.description}
          </p>
        )}
        {period.closes_at && (
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Closes {new Date(period.closes_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Voice Option */}
      <div className="mb-6">
        <VoiceNominate />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 rounded-lg text-sm" style={{
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}>
            {error}
          </div>
        )}

        {/* Your Name */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Your Name *
          </label>
          <input
            type="text"
            value={nominatorName}
            onChange={(e) => setNominatorName(e.target.value)}
            className="input"
            placeholder="Enter your name"
            required
          />
        </div>

        {/* Nominee Name */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Who are you nominating? *
          </label>
          <input
            type="text"
            value={nomineeName}
            onChange={(e) => setNomineeName(e.target.value)}
            className="input"
            placeholder="Teammate's name"
            required
          />
        </div>

        {/* Company Value */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Which value did they demonstrate? *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(period.categories || []).map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setCompanyValue(v.key)}
                className="p-3 rounded-lg text-left transition-all"
                style={{
                  background: companyValue === v.key ? v.bgColor : 'var(--bg-card)',
                  color: companyValue === v.key ? v.color : 'var(--text-secondary)',
                  border: `2px solid ${companyValue === v.key ? v.color : 'var(--border-default)'}`,
                }}
              >
                <div className="text-xl mb-1">{v.emoji}</div>
                <div className="text-sm font-medium">{v.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Story */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Tell us the story *
          </label>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            className="input"
            rows={5}
            placeholder="Describe what they did and why it matters..."
            required
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Be specific about what happened and the impact it had.
          </p>
        </div>

        {/* Event Date */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            When did this happen? <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
          </label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="input"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving || !nomineeName.trim() || !nominatorName.trim() || !companyValue || !story.trim()}
          className="btn btn-primary w-full py-3"
          style={{ opacity: saving || !nomineeName.trim() || !nominatorName.trim() || !companyValue || !story.trim() ? 0.5 : 1 }}
        >
          {saving ? 'Submitting...' : 'Submit Nomination'}
        </button>
      </form>

      {/* Footer */}
      <div className="text-center mt-8 pt-6" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Christmas Air Conditioning &amp; Plumbing
        </p>
      </div>
    </div>
  );
}
