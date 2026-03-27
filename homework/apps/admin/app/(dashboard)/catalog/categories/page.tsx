'use client';

import { useEffect, useState, useCallback } from 'react';

interface Department {
  id: string;
  name: string;
  slug: string;
}

interface Category {
  id: string;
  department_id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  department: Department | null;
  service_count: number;
}

function TableSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-40 bg-[var(--admin-surface)] rounded animate-pulse" />
          <div className="h-4 w-56 bg-[var(--admin-surface)] rounded animate-pulse mt-2" />
        </div>
        <div className="h-9 w-32 bg-[var(--admin-surface)] rounded animate-pulse" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-9 w-48 bg-[var(--admin-surface)] rounded animate-pulse" />
        <div className="h-9 w-40 bg-[var(--admin-surface)] rounded animate-pulse" />
      </div>
      <div className="admin-card p-0">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[var(--admin-border)]">
            <div className="h-4 w-32 bg-[var(--admin-surface)] rounded animate-pulse" />
            <div className="h-4 w-20 bg-[var(--admin-surface)] rounded animate-pulse" />
            <div className="h-4 w-24 bg-[var(--admin-surface)] rounded animate-pulse" />
            <div className="h-4 w-12 bg-[var(--admin-surface)] rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

function departmentBadgeClass(deptName: string | null | undefined): string {
  if (!deptName) return 'badge-gray';
  const lower = deptName.toLowerCase();
  if (lower.includes('lot')) return 'badge-green';
  if (lower.includes('exterior')) return 'badge-blue';
  if (lower.includes('interior')) return 'badge-purple';
  return 'badge-gray';
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', slug: '', description: '', department_id: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [catRes, deptRes] = await Promise.all([
        fetch('/api/catalog/categories'),
        fetch('/api/catalog/departments'),
      ]);
      if (!catRes.ok) throw new Error('Failed to load categories');
      if (!deptRes.ok) throw new Error('Failed to load departments');
      const [catData, deptData] = await Promise.all([catRes.json(), deptRes.json()]);
      setCategories(catData);
      setDepartments(deptData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = categories.filter((cat) => {
    if (departmentFilter !== 'all' && cat.department_id !== departmentFilter) return false;
    if (search && !cat.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const uniqueDepts = departments.map((d) => ({ id: d.id, name: d.name }));

  const handleCreate = async () => {
    if (!createForm.name || !createForm.slug || !createForm.department_id) {
      alert('Name, slug, and department are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/catalog/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create');
      }
      setShowCreateModal(false);
      setCreateForm({ name: '', slug: '', description: '', department_id: '' });
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <TableSkeleton />;

  if (error) {
    return (
      <div className="p-6">
        <div className="admin-card text-center py-12">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-secondary mt-4 text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--admin-text)]">Categories</h1>
          <p className="text-sm text-[var(--admin-text-muted)] mt-1">
            {categories.length} categories across {uniqueDepts.length} departments
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Category
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-input max-w-xs"
        />
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="admin-select"
        >
          <option value="all">All Departments</option>
          {uniqueDepts.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <span className="text-sm text-[var(--admin-text-muted)] ml-auto">
          {filtered.length} results
        </span>
      </div>

      {/* Table */}
      <div className="admin-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Department</th>
                <th>Slug</th>
                <th>Services</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-[var(--admin-text-muted)]">
                    No categories found
                  </td>
                </tr>
              ) : (
                filtered.map((cat) => (
                  <tr key={cat.id}>
                    <td className="font-medium text-[var(--admin-text)]">{cat.name}</td>
                    <td>
                      <span className={`badge ${departmentBadgeClass(cat.department?.name)}`}>
                        {cat.department?.name || 'Unknown'}
                      </span>
                    </td>
                    <td>
                      <code className="text-xs px-1.5 py-0.5 rounded bg-[var(--admin-surface)] text-[var(--admin-text-muted)]">
                        {cat.slug}
                      </code>
                    </td>
                    <td>{cat.service_count}</td>
                    <td>
                      <span className={`badge ${cat.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="admin-card w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-[var(--admin-text)] mb-4">
              Create Category
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">
                  Department
                </label>
                <select
                  value={createForm.department_id}
                  onChange={(e) => setCreateForm({ ...createForm, department_id: e.target.value })}
                  className="admin-select w-full"
                >
                  <option value="">Select department...</option>
                  {uniqueDepts.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="admin-input"
                  placeholder="e.g. Lawn Care"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">
                  Slug
                </label>
                <input
                  type="text"
                  value={createForm.slug}
                  onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                  className="admin-input"
                  placeholder="e.g. lawn-care"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">
                  Description
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={3}
                  className="admin-input resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary text-sm"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="btn-primary text-sm"
                disabled={saving}
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
