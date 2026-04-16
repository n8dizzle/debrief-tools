'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/bpp-utils';
import { useBPPPermissions } from '@/hooks/useBPPPermissions';
import { BPPCategory } from '@/lib/supabase';

export default function CategoriesPage() {
  const { canManageCategories } = useBPPPermissions();
  const [categories, setCategories] = useState<BPPCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCat, setEditCat] = useState<BPPCategory | null>(null);
  const [form, setForm] = useState({ name: '', description: '', depreciation_type: 'declining_balance', useful_life_years: '5', sort_order: '99' });
  const [saving, setSaving] = useState(false);

  const fetchCategories = () => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(setCategories)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCategories(); }, []);

  const resetForm = () => {
    setForm({ name: '', description: '', depreciation_type: 'declining_balance', useful_life_years: '5', sort_order: '99' });
    setEditCat(null);
    setShowForm(false);
  };

  const handleEdit = (cat: BPPCategory) => {
    setForm({
      name: cat.name,
      description: cat.description || '',
      depreciation_type: cat.depreciation_type,
      useful_life_years: String(cat.useful_life_years),
      sort_order: String(cat.sort_order),
    });
    setEditCat(cat);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editCat ? `/api/categories/${editCat.id}` : '/api/categories';
      const method = editCat ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          useful_life_years: parseInt(form.useful_life_years),
          sort_order: parseInt(form.sort_order),
        }),
      });
      if (!res.ok) throw new Error('Failed');
      resetForm();
      fetchCategories();
    } catch { alert('Failed to save category'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category? Only works if no assets are linked.')) return;
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to delete');
      return;
    }
    fetchCategories();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>Categories</h1>
        {canManageCategories && (
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn btn-primary gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Category
          </button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => resetForm()}>
          <div className="card max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>{editCat ? 'Edit Category' : 'Add Category'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Name *</label>
                <input type="text" className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Description</label>
                <input type="text" className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Depreciation Type</label>
                  <select className="select" value={form.depreciation_type} onChange={e => setForm(f => ({ ...f, depreciation_type: e.target.value }))}>
                    <option value="declining_balance">Declining Balance</option>
                    <option value="straight_line">Straight Line</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Useful Life (years)</label>
                  <input type="number" className="input" min="1" value={form.useful_life_years} onChange={e => setForm(f => ({ ...f, useful_life_years: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Sort Order</label>
                  <input type="number" className="input" min="0" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editCat ? 'Update' : 'Add Category'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card p-0">
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : (
          <div className="table-wrapper">
            <table className="bpp-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th className="text-right">Assets</th>
                  <th className="text-right">Total Value</th>
                  <th>Depreciation</th>
                  <th>Life</th>
                  {canManageCategories && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => (
                  <tr key={cat.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{cat.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{cat.description || '-'}</td>
                    <td className="text-right" style={{ color: 'var(--text-secondary)' }}>{cat.asset_count || 0}</td>
                    <td className="text-right" style={{ color: 'var(--text-primary)' }}>{formatCurrency(cat.total_value || 0)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{cat.depreciation_type.replace('_', ' ')}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{cat.useful_life_years}yr</td>
                    {canManageCategories && (
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleEdit(cat)} className="text-xs px-2 py-1" style={{ color: 'var(--christmas-green-light)' }}>Edit</button>
                          <button onClick={() => handleDelete(cat.id)} className="text-xs px-2 py-1" style={{ color: 'var(--status-error)' }}>Delete</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
