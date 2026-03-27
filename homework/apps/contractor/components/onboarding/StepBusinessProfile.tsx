'use client';

import { useState } from 'react';
import BusinessLookupButton from './BusinessLookupButton';

export interface BusinessProfileData {
  business_name: string;
  owner_name: string;
  phone: string;
  business_email: string;
  website_url: string;
  business_description: string;
  logo_url: string;
  address_line1: string;
  city: string;
  state: string;
  zip_code: string;
  // From AI enrichment
  years_in_business: number | null;
  employee_count: number | null;
}

interface StepBusinessProfileProps {
  data: BusinessProfileData;
  onChange: (data: BusinessProfileData) => void;
  onNext: () => void;
}

export default function StepBusinessProfile({ data, onChange, onNext }: StepBusinessProfileProps) {
  const [error, setError] = useState('');

  function update(field: keyof BusinessProfileData, value: string | number | null) {
    onChange({ ...data, [field]: value });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleLookupResult(result: any) {
    const enrichment = result.ai_enrichment as Record<string, unknown> | undefined;
    onChange({
      ...data,
      business_name: (result.business_name as string) || data.business_name,
      phone: (result.phone as string) || data.phone,
      website_url: (result.website as string) || data.website_url,
      logo_url: (result.photo_url as string) || data.logo_url,
      address_line1: (result.address_line1 as string) || data.address_line1,
      city: (result.city as string) || data.city,
      state: (result.state as string) || data.state,
      zip_code: (result.zip_code as string) || data.zip_code,
      business_description: enrichment?.description as string || data.business_description,
      years_in_business: enrichment?.years_in_business as number || data.years_in_business,
      employee_count: enrichment?.team_size as number || data.employee_count,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!data.business_name.trim() || !data.owner_name.trim()) {
      setError('Business name and your name are required');
      return;
    }

    onNext();
  }

  const labelStyle = {
    display: 'block' as const,
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '0.375rem',
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
        Business Profile
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
        Tell us about your business. We can look it up to save you time.
      </p>

      {error && (
        <div style={{
          background: 'var(--status-error-bg, #FEF2F2)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          color: 'var(--status-error)',
          fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      {/* Business name + lookup */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Business Name *</label>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <input
            type="text"
            className="input"
            placeholder="ABC Plumbing"
            value={data.business_name}
            onChange={(e) => update('business_name', e.target.value)}
            required
            style={{ flex: 1 }}
          />
          <BusinessLookupButton
            businessName={data.business_name}
            onResult={handleLookupResult}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={labelStyle}>Your Name *</label>
          <input
            type="text"
            className="input"
            placeholder="John Smith"
            value={data.owner_name}
            onChange={(e) => update('owner_name', e.target.value)}
            required
          />
        </div>
        <div>
          <label style={labelStyle}>Phone</label>
          <input
            type="tel"
            className="input"
            placeholder="(555) 123-4567"
            value={data.phone}
            onChange={(e) => update('phone', e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={labelStyle}>Business Email</label>
          <input
            type="email"
            className="input"
            placeholder="info@abcplumbing.com"
            value={data.business_email}
            onChange={(e) => update('business_email', e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Website</label>
          <input
            type="url"
            className="input"
            placeholder="https://abcplumbing.com"
            value={data.website_url}
            onChange={(e) => update('website_url', e.target.value)}
          />
        </div>
      </div>

      {/* Address */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Street Address</label>
        <input
          type="text"
          className="input"
          placeholder="123 Main St"
          value={data.address_line1}
          onChange={(e) => update('address_line1', e.target.value)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={labelStyle}>City</label>
          <input
            type="text"
            className="input"
            placeholder="Dallas"
            value={data.city}
            onChange={(e) => update('city', e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>State</label>
          <input
            type="text"
            className="input"
            value={data.state}
            onChange={(e) => update('state', e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>ZIP</label>
          <input
            type="text"
            className="input"
            placeholder="75201"
            value={data.zip_code}
            onChange={(e) => update('zip_code', e.target.value)}
          />
        </div>
      </div>

      {/* Description */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={labelStyle}>Business Description</label>
        <textarea
          className="input"
          rows={3}
          placeholder="Brief description of your business..."
          value={data.business_description}
          onChange={(e) => update('business_description', e.target.value)}
          style={{ resize: 'vertical' }}
        />
      </div>

      <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.75rem', fontSize: '0.9375rem' }}>
        Continue
      </button>
    </form>
  );
}
