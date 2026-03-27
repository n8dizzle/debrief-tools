'use client';

import { useState } from 'react';
import { BUSINESS_TYPES } from '@/lib/business-types';

export interface BusinessTypeData {
  business_types: string[];
  years_in_business: number | null;
  employee_count: number | null;
}

interface StepBusinessTypeProps {
  data: BusinessTypeData;
  onChange: (data: BusinessTypeData) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepBusinessType({ data, onChange, onNext, onBack }: StepBusinessTypeProps) {
  const [error, setError] = useState('');

  function toggleType(typeId: string) {
    const current = data.business_types;
    const updated = current.includes(typeId)
      ? current.filter((id) => id !== typeId)
      : [...current, typeId];
    onChange({ ...data, business_types: updated });
  }

  function handleNext() {
    setError('');
    if (data.business_types.length === 0) {
      setError('Select at least one business type');
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
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
        What type of business do you run?
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
        Select all that apply. This determines which services appear in your price book.
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.625rem',
          marginBottom: '1.5rem',
          maxHeight: '360px',
          overflowY: 'auto',
          paddingRight: '0.25rem',
        }}
      >
        {BUSINESS_TYPES.map((bt) => {
          const isSelected = data.business_types.includes(bt.id);
          return (
            <button
              key={bt.id}
              type="button"
              onClick={() => toggleType(bt.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: isSelected ? 'var(--status-info-bg, #F0FAF8)' : 'var(--bg-input)',
                border: `2px solid ${isSelected ? 'var(--hw-blue)' : 'var(--border-default)'}`,
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                color: 'var(--text-primary)',
                width: '100%',
              }}
            >
              <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{bt.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.3 }}>{bt.label}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.3, marginTop: '0.125rem' }}>
                  {bt.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Additional details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label style={labelStyle}>Years in Business</label>
          <input
            type="number"
            className="input"
            placeholder="e.g. 5"
            min={0}
            max={100}
            value={data.years_in_business ?? ''}
            onChange={(e) => onChange({ ...data, years_in_business: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
        <div>
          <label style={labelStyle}>Number of Employees</label>
          <input
            type="number"
            className="input"
            placeholder="e.g. 10"
            min={1}
            max={500}
            value={data.employee_count ?? ''}
            onChange={(e) => onChange({ ...data, employee_count: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="button" className="btn-secondary" onClick={onBack} style={{ flex: 1, padding: '0.75rem' }}>
          Back
        </button>
        <button type="button" className="btn-primary" onClick={handleNext} style={{ flex: 2, padding: '0.75rem', fontSize: '0.9375rem' }}>
          Continue
        </button>
      </div>
    </div>
  );
}
