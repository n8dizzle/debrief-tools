'use client';

import { useState, useEffect } from 'react';
import { useBPPPermissions } from '@/hooks/useBPPPermissions';

interface CategoryWithSchedules {
  id: string;
  name: string;
  depreciation_type: string;
  useful_life_years: number;
  schedules: { id: string; age_years: number; depreciation_percent: number }[];
}

export default function DepreciationPage() {
  const { canManageCategories } = useBPPPermissions();
  const [categories, setCategories] = useState<CategoryWithSchedules[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCat, setEditCat] = useState<string | null>(null);
  const [editSchedules, setEditSchedules] = useState<{ age_years: number; depreciation_percent: number }[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    fetch('/api/depreciation')
      .then(r => r.json())
      .then(setCategories)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleEdit = (cat: CategoryWithSchedules) => {
    setEditCat(cat.id);
    setEditSchedules(cat.schedules.map(s => ({ age_years: s.age_years, depreciation_percent: s.depreciation_percent })));
  };

  const handleSave = async () => {
    if (!editCat) return;
    setSaving(true);
    try {
      const res = await fetch('/api/depreciation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: editCat, schedules: editSchedules }),
      });
      if (!res.ok) throw new Error('Failed');
      setEditCat(null);
      fetchData();
    } catch { alert('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleAddRow = () => {
    const maxAge = editSchedules.length > 0 ? Math.max(...editSchedules.map(s => s.age_years)) + 1 : 0;
    const lastPct = editSchedules.length > 0 ? editSchedules[editSchedules.length - 1].depreciation_percent : 100;
    setEditSchedules([...editSchedules, { age_years: maxAge, depreciation_percent: Math.max(lastPct - 10, 5) }]);
  };

  const handleRemoveRow = (idx: number) => {
    setEditSchedules(editSchedules.filter((_, i) => i !== idx));
  };

  const handlePctChange = (idx: number, value: string) => {
    const pct = parseFloat(value);
    if (isNaN(pct)) return;
    setEditSchedules(editSchedules.map((s, i) => i === idx ? { ...s, depreciation_percent: pct } : s));
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div style={{ color: 'var(--text-muted)' }}>Loading...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>Depreciation Schedules</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Texas BPP percent-good tables by asset category</p>
      </div>

      {categories.map(cat => (
        <div key={cat.id} className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>{cat.name}</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {cat.depreciation_type.replace('_', ' ')} | {cat.useful_life_years}-year useful life
              </p>
            </div>
            {canManageCategories && editCat !== cat.id && (
              <button onClick={() => handleEdit(cat)} className="btn btn-secondary text-sm">Edit</button>
            )}
          </div>

          {editCat === cat.id ? (
            <div>
              <div className="space-y-2 mb-4">
                <div className="grid grid-cols-3 gap-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  <div>Age (years)</div>
                  <div>% of Original Cost</div>
                  <div></div>
                </div>
                {editSchedules.map((s, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.age_years}</div>
                    <input
                      type="number"
                      className="input"
                      min="0"
                      max="100"
                      step="0.5"
                      value={s.depreciation_percent}
                      onChange={e => handlePctChange(idx, e.target.value)}
                    />
                    <button onClick={() => handleRemoveRow(idx)} className="text-xs" style={{ color: 'var(--status-error)' }}>Remove</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddRow} className="btn btn-secondary text-sm">+ Add Year</button>
                <button onClick={handleSave} className="btn btn-primary text-sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button onClick={() => setEditCat(null)} className="btn btn-secondary text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="bpp-table">
                <thead>
                  <tr>
                    <th>Age</th>
                    <th className="text-right">% of Cost</th>
                    <th>Visual</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.schedules.map(s => (
                    <tr key={s.age_years}>
                      <td style={{ color: 'var(--text-secondary)' }}>{s.age_years} yr{s.age_years === 0 ? ' (new)' : ''}</td>
                      <td className="text-right" style={{ color: 'var(--text-primary)' }}>{s.depreciation_percent}%</td>
                      <td>
                        <div className="w-full h-3 rounded-full" style={{ background: 'var(--bg-secondary)' }}>
                          <div
                            className="h-3 rounded-full transition-all"
                            style={{ width: `${s.depreciation_percent}%`, background: 'var(--christmas-green)' }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
