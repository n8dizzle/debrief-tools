'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatCurrency, calculateAssetAge, getConditionLabel, getConditionColor } from '@/lib/bpp-utils';
import { useBPPPermissions } from '@/hooks/useBPPPermissions';
import { BPPAsset, BPPCategory } from '@/lib/supabase';

export default function AssetsPage() {
  const { canManageAssets } = useBPPPermissions();
  const [assets, setAssets] = useState<BPPAsset[]>([]);
  const [categories, setCategories] = useState<BPPCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAsset, setEditAsset] = useState<BPPAsset | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [showDisposed, setShowDisposed] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  // Form state
  const [form, setForm] = useState({
    category_id: '', description: '', subcategory: '', quantity: '1',
    unit_cost: '', year_acquired: '', condition: 'good',
    location: '', serial_number: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchAssets = useCallback(() => {
    const params = new URLSearchParams();
    if (categoryFilter) params.set('category', categoryFilter);
    if (conditionFilter) params.set('condition', conditionFilter);
    if (search) params.set('search', search);
    params.set('disposed', showDisposed ? 'true' : 'false');
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);

    fetch(`/api/assets?${params}`)
      .then(res => res.json())
      .then(setAssets)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [categoryFilter, conditionFilter, search, showDisposed, sortBy, sortDir]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(setCategories).catch(console.error);
  }, []);

  const resetForm = () => {
    setForm({ category_id: '', description: '', subcategory: '', quantity: '1', unit_cost: '', year_acquired: '', condition: 'good', location: '', serial_number: '', notes: '' });
    setEditAsset(null);
    setShowForm(false);
  };

  const handleEdit = (asset: BPPAsset) => {
    setForm({
      category_id: asset.category_id,
      description: asset.description,
      subcategory: asset.subcategory || '',
      quantity: String(asset.quantity),
      unit_cost: String(asset.unit_cost),
      year_acquired: String(asset.year_acquired),
      condition: asset.condition,
      location: asset.location || '',
      serial_number: asset.serial_number || '',
      notes: asset.notes || '',
    });
    setEditAsset(asset);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...form,
      quantity: parseInt(form.quantity),
      unit_cost: parseFloat(form.unit_cost),
      year_acquired: parseInt(form.year_acquired),
    };

    try {
      const url = editAsset ? `/api/assets/${editAsset.id}` : '/api/assets';
      const method = editAsset ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to save');
      resetForm();
      fetchAssets();
    } catch (err) {
      console.error(err);
      alert('Failed to save asset');
    } finally {
      setSaving(false);
    }
  };

  const handleDispose = async (assetId: string) => {
    if (!confirm('Mark this asset as disposed?')) return;
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const day = String(new Date().getDate()).padStart(2, '0');
    await fetch(`/api/assets/${assetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disposed: true, disposed_date: `${year}-${month}-${day}` }),
    });
    fetchAssets();
  };

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return null;
    return <span className="ml-1">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>Assets</h1>
        {canManageAssets && (
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn btn-primary gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Asset
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input type="text" className="input" placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select" value={conditionFilter} onChange={e => setConditionFilter(e.target.value)}>
            <option value="">All Conditions</option>
            <option value="new">New</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </select>
          <label className="flex items-center gap-2 px-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={showDisposed} onChange={e => setShowDisposed(e.target.checked)} />
            Show Disposed
          </label>
        </div>
      </div>

      {/* Asset Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => resetForm()}>
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              {editAsset ? 'Edit Asset' : 'Add Asset'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Category *</label>
                  <select className="select" required value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Subcategory</label>
                  <input type="text" className="input" placeholder="e.g. Power Tools" value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Description *</label>
                <input type="text" className="input" required placeholder="e.g. 2022 Ford F-150" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Quantity *</label>
                  <input type="number" className="input" required min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Unit Cost *</label>
                  <input type="number" className="input" required min="0" step="0.01" placeholder="0.00" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Year Acquired *</label>
                  <input type="number" className="input" required min="1900" max={new Date().getFullYear()} value={form.year_acquired} onChange={e => setForm(f => ({ ...f, year_acquired: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Condition</label>
                  <select className="select" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                    <option value="new">New</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Location</label>
                  <input type="text" className="input" placeholder="e.g. Warehouse, Truck #5" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Serial/VIN</label>
                  <input type="text" className="input" value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editAsset ? 'Update Asset' : 'Add Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Asset Table */}
      <div className="card p-0">
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading assets...</div>
        ) : assets.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
            No assets found. {canManageAssets && <button onClick={() => setShowForm(true)} className="underline" style={{ color: 'var(--christmas-green-light)' }}>Add your first asset</button>}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="bpp-table">
              <thead>
                <tr>
                  <th className="cursor-pointer" onClick={() => handleSort('description')}>Description <SortIcon col="description" /></th>
                  <th>Category</th>
                  <th className="text-right cursor-pointer" onClick={() => handleSort('quantity')}>Qty <SortIcon col="quantity" /></th>
                  <th className="text-right cursor-pointer" onClick={() => handleSort('unit_cost')}>Unit Cost <SortIcon col="unit_cost" /></th>
                  <th className="text-right">Total Cost</th>
                  <th className="cursor-pointer" onClick={() => handleSort('year_acquired')}>Year <SortIcon col="year_acquired" /></th>
                  <th>Age</th>
                  <th>Condition</th>
                  {canManageAssets && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {assets.map(asset => (
                  <tr key={asset.id} className={asset.disposed ? 'opacity-50' : ''}>
                    <td>
                      <Link href={`/assets/${asset.id}`} style={{ color: 'var(--christmas-green-light)' }}>
                        {asset.description}
                      </Link>
                      {asset.disposed && <span className="badge badge-disposed ml-2">Disposed</span>}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{(asset.category as any)?.name || ''}</td>
                    <td className="text-right" style={{ color: 'var(--text-secondary)' }}>{asset.quantity}</td>
                    <td className="text-right" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(asset.unit_cost)}</td>
                    <td className="text-right" style={{ color: 'var(--text-primary)' }}>{formatCurrency(Number(asset.total_cost))}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{asset.year_acquired}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{calculateAssetAge(asset.year_acquired)}yr</td>
                    <td>
                      <span className="badge" style={{ backgroundColor: `${getConditionColor(asset.condition)}20`, color: getConditionColor(asset.condition) }}>
                        {getConditionLabel(asset.condition)}
                      </span>
                    </td>
                    {canManageAssets && (
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleEdit(asset)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--christmas-green-light)' }}>Edit</button>
                          {!asset.disposed && (
                            <button onClick={() => handleDispose(asset.id)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--status-warning)' }}>Dispose</button>
                          )}
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
