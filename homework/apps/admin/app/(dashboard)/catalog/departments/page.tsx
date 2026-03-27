'use client';

import { useEffect, useState, useCallback } from 'react';

interface Department {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  category_count: number;
  service_count: number;
  created_at: string;
}

function DepartmentIcon({ name, className }: { name: string; className?: string }) {
  const slug = name.toLowerCase();
  if (slug.includes('lot')) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    );
  }
  if (slug.includes('exterior')) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </svg>
  );
}

function getColorForIndex(index: number) {
  const colors = [
    { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
    { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
    { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
    { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  ];
  return colors[index % colors.length];
}

function TableSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-40 bg-[var(--admin-surface)] rounded animate-pulse" />
          <div className="h-4 w-80 bg-[var(--admin-surface)] rounded animate-pulse mt-2" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="admin-card animate-pulse">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[var(--admin-surface)]" />
              <div className="flex-1">
                <div className="h-5 w-24 bg-[var(--admin-surface)] rounded" />
                <div className="h-3 w-full bg-[var(--admin-surface)] rounded mt-2" />
              </div>
            </div>
            <div className="flex items-center gap-4 mt-5 pt-4 border-t border-[var(--admin-border)]">
              <div className="flex-1">
                <div className="h-3 w-16 bg-[var(--admin-surface)] rounded" />
                <div className="h-6 w-8 bg-[var(--admin-surface)] rounded mt-1" />
              </div>
              <div className="flex-1">
                <div className="h-3 w-16 bg-[var(--admin-surface)] rounded" />
                <div className="h-6 w-8 bg-[var(--admin-surface)] rounded mt-1" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editForm, setEditForm] = useState({ name: '', slug: '', description: '' });
  const [saving, setSaving] = useState(false);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch('/api/catalog/departments');
      if (!res.ok) throw new Error('Failed to load departments');
      const data = await res.json();
      setDepartments(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const openEdit = (dept: Department) => {
    setEditingDept(dept);
    setEditForm({
      name: dept.name,
      slug: dept.slug,
      description: dept.description || '',
    });
  };

  const handleSave = async () => {
    if (!editingDept) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/catalog/departments/${editingDept.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update');
      }
      setEditingDept(null);
      await fetchDepartments();
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
          <h1 className="text-2xl font-bold text-[var(--admin-text)]">Departments</h1>
          <p className="text-sm text-[var(--admin-text-muted)] mt-1">
            Top-level service organization. Each department contains categories and services.
          </p>
        </div>
      </div>

      {/* Department Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {departments.map((dept, index) => {
          const colors = getColorForIndex(index);
          return (
            <div key={dept.id} className="admin-card admin-card-hover">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                  <DepartmentIcon name={dept.name} className={`w-6 h-6 ${colors.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-[var(--admin-text)]">
                    {dept.name}
                  </h3>
                  <p className="text-sm text-[var(--admin-text-muted)] mt-1 line-clamp-2">
                    {dept.description || 'No description'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-5 pt-4 border-t border-[var(--admin-border)]">
                <div className="flex-1">
                  <p className="text-xs text-[var(--admin-text-muted)] uppercase tracking-wide">Categories</p>
                  <p className="text-xl font-bold text-[var(--admin-text)] mt-0.5">{dept.category_count}</p>
                </div>
                <div className="w-px h-10 bg-[var(--admin-border)]" />
                <div className="flex-1">
                  <p className="text-xs text-[var(--admin-text-muted)] uppercase tracking-wide">Services</p>
                  <p className="text-xl font-bold text-[var(--admin-text)] mt-0.5">{dept.service_count}</p>
                </div>
                <button
                  onClick={() => openEdit(dept)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Department Summary Table */}
      <div className="admin-card">
        <h2 className="text-base font-semibold text-[var(--admin-text)] mb-4">
          Department Summary
        </h2>
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Slug</th>
                <th>Categories</th>
                <th>Services</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => (
                <tr key={dept.id}>
                  <td className="font-medium text-[var(--admin-text)]">{dept.name}</td>
                  <td>
                    <code className="text-xs px-1.5 py-0.5 rounded bg-[var(--admin-surface)] text-[var(--admin-text-muted)]">
                      {dept.slug}
                    </code>
                  </td>
                  <td>{dept.category_count}</td>
                  <td>{dept.service_count}</td>
                  <td>
                    <span className={`badge ${dept.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {dept.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="admin-card w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-[var(--admin-text)] mb-4">
              Edit Department
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="admin-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">
                  Slug
                </label>
                <input
                  type="text"
                  value={editForm.slug}
                  onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                  className="admin-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wide mb-1.5">
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="admin-input resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setEditingDept(null)}
                className="btn-secondary text-sm"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn-primary text-sm"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
