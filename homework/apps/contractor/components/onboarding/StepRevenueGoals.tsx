'use client';

import { useState } from 'react';
import CostStructureSlider from './CostStructureSlider';
import { DFW_BENCHMARKS } from '@/lib/business-types';

export interface RevenueGoalsData {
  annual_revenue_target: number;
  jobs_per_week_target: number;
  labor_cost_pct: number;
  materials_cost_pct: number;
  overhead_pct: number;
  profit_margin_pct: number;
}

interface StepRevenueGoalsProps {
  data: RevenueGoalsData;
  onChange: (data: RevenueGoalsData) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepRevenueGoals({ data, onChange, onNext, onBack }: StepRevenueGoalsProps) {
  const [error, setError] = useState('');

  function update(field: keyof RevenueGoalsData, value: number) {
    onChange({ ...data, [field]: value });
  }

  const totalPct = data.labor_cost_pct + data.materials_cost_pct + data.overhead_pct + data.profit_margin_pct;
  const isOverBudget = totalPct > 100;

  function handleNext() {
    setError('');
    if (data.annual_revenue_target < 10000) {
      setError('Annual revenue target must be at least $10,000');
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

  // Format currency for display
  function formatCurrency(cents: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents);
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
        Revenue Goals & Cost Structure
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
        Help us price your services. We&apos;ll use DFW market data and your cost structure to generate competitive prices.
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

      {/* Revenue targets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label style={labelStyle}>Annual Revenue Target</label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', fontSize: '0.875rem',
            }}>$</span>
            <input
              type="number"
              className="input"
              placeholder="500000"
              min={10000}
              max={10000000}
              step={10000}
              value={data.annual_revenue_target || ''}
              onChange={(e) => update('annual_revenue_target', Number(e.target.value))}
              style={{ paddingLeft: '1.5rem' }}
            />
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {data.annual_revenue_target ? formatCurrency(data.annual_revenue_target) + '/year' : '$100K — $5M'}
          </span>
        </div>
        <div>
          <label style={labelStyle}>Jobs Per Week Target</label>
          <input
            type="number"
            className="input"
            placeholder="10"
            min={1}
            max={200}
            value={data.jobs_per_week_target || ''}
            onChange={(e) => update('jobs_per_week_target', Number(e.target.value))}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            How many jobs per week?
          </span>
        </div>
      </div>

      {/* Cost structure sliders */}
      <div style={{
        padding: '1.25rem',
        background: 'var(--bg-input)',
        borderRadius: '10px',
        border: '1px solid var(--border-default)',
        marginBottom: '1rem',
      }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 1rem' }}>
          Cost Structure
        </h3>

        <CostStructureSlider
          label="Labor"
          value={data.labor_cost_pct}
          onChange={(v) => update('labor_cost_pct', v)}
          min={DFW_BENCHMARKS.labor.min}
          max={DFW_BENCHMARKS.labor.max}
          benchmark={DFW_BENCHMARKS.labor.label}
        />
        <CostStructureSlider
          label="Materials"
          value={data.materials_cost_pct}
          onChange={(v) => update('materials_cost_pct', v)}
          min={DFW_BENCHMARKS.materials.min}
          max={DFW_BENCHMARKS.materials.max}
          benchmark={DFW_BENCHMARKS.materials.label}
        />
        <CostStructureSlider
          label="Overhead"
          value={data.overhead_pct}
          onChange={(v) => update('overhead_pct', v)}
          min={DFW_BENCHMARKS.overhead.min}
          max={DFW_BENCHMARKS.overhead.max}
          benchmark={DFW_BENCHMARKS.overhead.label}
        />
        <CostStructureSlider
          label="Target Profit Margin"
          value={data.profit_margin_pct}
          onChange={(v) => update('profit_margin_pct', v)}
          min={DFW_BENCHMARKS.profit.min}
          max={DFW_BENCHMARKS.profit.max}
          benchmark={DFW_BENCHMARKS.profit.label}
        />

        {/* Total bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem',
          background: isOverBudget ? 'rgba(239, 68, 68, 0.08)' : 'rgba(59, 155, 143, 0.08)',
          borderRadius: '8px',
          border: `1px solid ${isOverBudget ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 155, 143, 0.2)'}`,
          marginTop: '0.5rem',
        }}>
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--hw-blue)' }}>L {data.labor_cost_pct}%</span>
            <span style={{ color: 'var(--text-muted)' }}>+</span>
            <span style={{ color: 'var(--hw-blue)' }}>M {data.materials_cost_pct}%</span>
            <span style={{ color: 'var(--text-muted)' }}>+</span>
            <span style={{ color: 'var(--hw-blue)' }}>O {data.overhead_pct}%</span>
            <span style={{ color: 'var(--text-muted)' }}>+</span>
            <span style={{ color: 'var(--hw-blue)' }}>P {data.profit_margin_pct}%</span>
          </div>
          <span style={{
            fontWeight: 600,
            fontSize: '0.875rem',
            color: isOverBudget ? 'var(--status-error)' : 'var(--hw-blue)',
          }}>
            = {totalPct}%
          </span>
        </div>
        {isOverBudget && (
          <p style={{ fontSize: '0.75rem', color: 'var(--status-error)', marginTop: '0.375rem' }}>
            Total exceeds 100%. Adjust your cost structure to be sustainable.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
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
