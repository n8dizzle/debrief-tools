'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  NominationPeriodStatus,
  NominationPeriodType,
  NominationCategory,
  CATEGORY_TEMPLATES,
  COMPANY_VALUES,
  QUARTER_LABELS,
  generatePeriodTitle,
  generatePeriodDates,
} from '@/lib/supabase';

const PRESET_COLORS = [
  '#22c55e', '#eab308', '#3b82f6', '#ec4899',
  '#f97316', '#8b5cf6', '#06b6d4', '#ef4444',
  '#14b8a6', '#a855f7',
];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

export default function NewPeriodPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [periodType, setPeriodType] = useState<NominationPeriodType>('quarterly');
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQuarter);
  const [description, setDescription] = useState('Nominate a colleague who consistently exhibits our company\'s core values. Anyone can nominate!');
  const [status, setStatus] = useState<NominationPeriodStatus>('open');
  const [template, setTemplate] = useState('company_values');
  const [categories, setCategories] = useState<NominationCategory[]>([...COMPANY_VALUES]);

  const autoTitle = generatePeriodTitle(periodType, year, quarter);
  const autoDates = generatePeriodDates(periodType, year, quarter);

  function handleTypeChange(type: NominationPeriodType) {
    setPeriodType(type);
    if (type === 'annual') {
      setTemplate('annual');
      setCategories([]);
    } else {
      setTemplate('company_values');
      setCategories([...COMPANY_VALUES]);
    }
  }

  function handleTemplateChange(templateKey: string) {
    setTemplate(templateKey);
    if (templateKey === 'custom') {
      setCategories([]);
    } else {
      const t = CATEGORY_TEMPLATES[templateKey];
      if (t) setCategories([...t.categories]);
    }
  }

  function addCategory() {
    const usedColors = categories.map(c => c.color);
    const nextColor = PRESET_COLORS.find(c => !usedColors.includes(c)) || PRESET_COLORS[0];
    setCategories([...categories, {
      key: '',
      label: '',
      emoji: '\u2B50',
      color: nextColor,
      bgColor: hexToRgba(nextColor, 0.15),
    }]);
  }

  function updateCategory(index: number, updates: Partial<NominationCategory>) {
    setCategories(prev => prev.map((c, i) => {
      if (i !== index) return c;
      const updated = { ...c, ...updates };
      if (updates.label !== undefined && !c.key) {
        updated.key = slugify(updates.label);
      }
      if (updates.color) {
        updated.bgColor = hexToRgba(updates.color, 0.15);
      }
      return updated;
    }));
  }

  function removeCategory(index: number) {
    setCategories(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (categories.length === 0) {
      setError('At least one category is required');
      return;
    }
    for (const cat of categories) {
      if (!cat.label.trim()) {
        setError('All categories must have a label');
        return;
      }
    }
    const finalCategories = categories.map(c => ({
      ...c,
      key: c.key || slugify(c.label),
      bgColor: c.bgColor || hexToRgba(c.color, 0.15),
    }));
    const keys = finalCategories.map(c => c.key);
    if (new Set(keys).size !== keys.length) {
      setError('Category names must be unique');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/nominations/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: autoTitle,
          description: description.trim() || null,
          status,
          period_type: periodType,
          year,
          quarter: periodType === 'quarterly' ? quarter : null,
          opens_at: autoDates.opens_at ? new Date(autoDates.opens_at).toISOString() : null,
          closes_at: autoDates.closes_at ? new Date(autoDates.closes_at).toISOString() : null,
          categories: finalCategories,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create period');
      }

      const { period } = await res.json();
      router.push(`/nominations/periods/${period.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--christmas-cream)' }}>
        Create Nomination Period
      </h1>

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

        {/* Period Type */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Period Type
          </label>
          <div className="flex gap-2">
            {([
              { key: 'quarterly' as const, label: 'Quarterly', desc: 'Company Values' },
              { key: 'annual' as const, label: 'Annual', desc: 'Custom Awards' },
            ]).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTypeChange(t.key)}
                className="flex-1 p-4 rounded-lg text-left transition-all"
                style={{
                  background: periodType === t.key ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
                  color: periodType === t.key ? '#22c55e' : 'var(--text-secondary)',
                  border: `1px solid ${periodType === t.key ? '#22c55e' : 'var(--border-default)'}`,
                }}
              >
                <div className="text-sm font-semibold">{t.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Year & Quarter */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Year
            </label>
            <div className="flex gap-2">
              {yearOptions.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setYear(y)}
                  className="flex-1 p-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: year === y ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
                    color: year === y ? '#22c55e' : 'var(--text-secondary)',
                    border: `1px solid ${year === y ? '#22c55e' : 'var(--border-default)'}`,
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
          {periodType === 'quarterly' && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Quarter
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([1, 2, 3, 4] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuarter(q)}
                    className="p-2.5 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: quarter === q ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
                      color: quarter === q ? '#22c55e' : 'var(--text-secondary)',
                      border: `1px solid ${quarter === q ? '#22c55e' : 'var(--border-default)'}`,
                    }}
                  >
                    {QUARTER_LABELS[q]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Auto-generated title preview */}
        <div
          className="rounded-lg p-3"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Title (auto-generated)</div>
          <div className="text-lg font-bold" style={{ color: 'var(--christmas-cream)' }}>{autoTitle}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {autoDates.opens_at} to {autoDates.closes_at}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
            rows={2}
            placeholder="Optional description or instructions for nominators"
          />
        </div>

        {/* Template (for categories) */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Category Template
          </label>
          <div className="flex gap-2">
            {Object.entries(CATEGORY_TEMPLATES).map(([key, t]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleTemplateChange(key)}
                className="flex-1 p-3 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: template === key ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
                  color: template === key ? '#22c55e' : 'var(--text-secondary)',
                  border: `1px solid ${template === key ? '#22c55e' : 'var(--border-default)'}`,
                }}
              >
                {t.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleTemplateChange('custom')}
              className="flex-1 p-3 rounded-lg text-sm font-medium transition-all"
              style={{
                background: template === 'custom' ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
                color: template === 'custom' ? '#22c55e' : 'var(--text-secondary)',
                border: `1px solid ${template === 'custom' ? '#22c55e' : 'var(--border-default)'}`,
              }}
            >
              Custom
            </button>
          </div>
        </div>

        {/* Categories Editor */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Categories *
          </label>
          <div className="space-y-2">
            {categories.map((cat, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-3 rounded-lg"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                <input
                  type="text"
                  value={cat.emoji}
                  onChange={(e) => updateCategory(i, { emoji: e.target.value })}
                  className="input text-center"
                  style={{ width: '3rem', padding: '0.25rem' }}
                  maxLength={2}
                />
                <input
                  type="text"
                  value={cat.label}
                  onChange={(e) => updateCategory(i, { label: e.target.value })}
                  className="input flex-1"
                  style={{ padding: '0.25rem 0.5rem' }}
                  placeholder="Category name"
                />
                <div className="flex gap-1">
                  {PRESET_COLORS.slice(0, 5).map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateCategory(i, { color })}
                      className="w-5 h-5 rounded-full transition-transform"
                      style={{
                        background: color,
                        transform: cat.color === color ? 'scale(1.3)' : 'scale(1)',
                        border: cat.color === color ? '2px solid white' : '1px solid transparent',
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={cat.color}
                    onChange={(e) => updateCategory(i, { color: e.target.value })}
                    className="w-5 h-5 rounded cursor-pointer"
                    style={{ padding: 0, border: 'none' }}
                    title="Custom color"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeCategory(i)}
                  className="text-xs px-2 py-1 rounded transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addCategory}
            className="mt-2 text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}
          >
            + Add Category
          </button>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Status
          </label>
          <div className="flex gap-2">
            {(['draft', 'open', 'closed'] as NominationPeriodStatus[]).map((s) => {
              const styles: Record<NominationPeriodStatus, { active: string; activeBorder: string }> = {
                draft: { active: 'rgba(156, 163, 175, 0.15)', activeBorder: '#9ca3af' },
                open: { active: 'rgba(34, 197, 94, 0.15)', activeBorder: '#22c55e' },
                closed: { active: 'rgba(239, 68, 68, 0.15)', activeBorder: '#ef4444' },
              };
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className="flex-1 p-3 rounded-lg text-sm font-medium capitalize transition-all"
                  style={{
                    background: status === s ? styles[s].active : 'var(--bg-card)',
                    color: status === s ? styles[s].activeBorder : 'var(--text-secondary)',
                    border: `1px solid ${status === s ? styles[s].activeBorder : 'var(--border-default)'}`,
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
            Only &quot;Open&quot; periods accept nominations. You can change this later.
          </p>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary px-6"
            style={{ opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Creating...' : 'Create Period'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/nominations')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
