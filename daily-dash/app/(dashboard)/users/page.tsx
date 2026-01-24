'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  APP_PERMISSIONS,
  ROLE_LABELS,
  hasPermission,
  type UserPermissions,
  type UserRole,
} from '@/lib/permissions';

interface Department {
  id: string;
  name: string;
  slug: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  department_id: string | null;
  is_active: boolean;
  permissions: UserPermissions;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  department: Department | null;
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'employee' as UserRole,
    department_id: '',
    is_active: true,
    permissions: {} as UserPermissions,
  });

  // Check if user is owner
  const isOwner = session?.user?.role === 'owner';

  // Redirect non-owners
  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || session.user.role !== 'owner') {
      router.push('/');
    }
  }, [session, status, router]);

  // Fetch users and departments
  useEffect(() => {
    if (!isOwner) return;

    async function fetchData() {
      try {
        const [usersRes, deptsRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/departments'),
        ]);

        if (!usersRes.ok) throw new Error('Failed to fetch users');
        if (!deptsRes.ok) throw new Error('Failed to fetch departments');

        const usersData = await usersRes.json();
        const deptsData = await deptsRes.json();

        setUsers(usersData.users || []);
        setDepartments(deptsData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isOwner]);

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      name: '',
      role: 'employee',
      department_id: '',
      is_active: true,
      permissions: {},
    });
    setModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name || '',
      role: user.role,
      department_id: user.department_id || '',
      is_active: user.is_active,
      permissions: user.permissions || {},
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setError(null);
  };

  const handlePermissionToggle = (app: string, permission: string) => {
    setFormData((prev) => {
      const newPermissions = { ...prev.permissions };
      const appPerms = { ...(newPermissions[app as keyof UserPermissions] || {}) } as Record<string, boolean>;

      if (appPerms[permission]) {
        delete appPerms[permission];
      } else {
        appPerms[permission] = true;
      }

      // Clean up empty app objects
      if (Object.keys(appPerms).length === 0) {
        delete newPermissions[app as keyof UserPermissions];
      } else {
        (newPermissions as Record<string, Record<string, boolean>>)[app] = appPerms;
      }

      return { ...prev, permissions: newPermissions };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PATCH' : 'POST';

      const body = editingUser
        ? {
            name: formData.name || null,
            role: formData.role,
            department_id: formData.department_id || null,
            is_active: formData.is_active,
            permissions: formData.permissions,
          }
        : {
            email: formData.email,
            name: formData.name || null,
            role: formData.role,
            department_id: formData.department_id || null,
            permissions: formData.permissions,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save user');
      }

      // Update users list
      if (editingUser) {
        setUsers((prev) =>
          prev.map((u) => (u.id === editingUser.id ? data.user : u))
        );
      } else {
        setUsers((prev) => [...prev, data.user]);
      }

      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (user: User) => {
    if (!confirm(`Are you sure you want to deactivate ${user.name || user.email}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to deactivate user');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: false } : u))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to deactivate user');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: 'var(--christmas-green)', borderTopColor: 'transparent' }}
          />
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--christmas-cream)' }}
          >
            User Management
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Manage user access and permissions across all internal tools
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--christmas-green)',
            color: 'var(--christmas-cream)',
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {error && !modalOpen && (
        <div
          className="p-3 rounded-lg mb-6 text-sm"
          style={{
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            color: '#dc2626',
          }}
        >
          {error}
        </div>
      )}

      {/* Users Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                <th className="text-left px-5 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>
                  User
                </th>
                <th className="text-left px-5 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Role
                </th>
                <th className="text-left px-5 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Department
                </th>
                <th className="text-left px-5 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Status
                </th>
                <th className="text-left px-5 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Last Login
                </th>
                <th className="text-right px-5 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: idx < users.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    opacity: user.is_active ? 1 : 0.5,
                  }}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                        style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
                      >
                        {user.name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                          {user.name || 'No name'}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor:
                          user.role === 'owner'
                            ? 'rgba(184, 149, 107, 0.2)'
                            : user.role === 'manager'
                            ? 'rgba(59, 130, 246, 0.2)'
                            : 'rgba(107, 114, 128, 0.2)',
                        color:
                          user.role === 'owner'
                            ? 'var(--christmas-gold)'
                            : user.role === 'manager'
                            ? '#3B82F6'
                            : 'var(--text-secondary)',
                      }}
                    >
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-5 py-4" style={{ color: 'var(--text-secondary)' }}>
                    {user.department?.name || '-'}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs"
                      style={{ color: user.is_active ? '#4ADE80' : '#ef4444' }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: user.is_active ? '#4ADE80' : '#ef4444' }}
                      />
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-4" style={{ color: 'var(--text-muted)' }}>
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Never'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 rounded-lg transition-colors hover:bg-white/10"
                        style={{ color: 'var(--text-secondary)' }}
                        title="Edit user"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      {user.is_active && user.email !== session?.user?.email && (
                        <button
                          onClick={() => handleDeactivate(user)}
                          className="p-2 rounded-lg transition-colors hover:bg-red-500/10"
                          style={{ color: '#ef4444' }}
                          title="Deactivate user"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={closeModal}
          />

          {/* Modal */}
          <div
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                {editingUser ? 'Edit User' : 'Add User'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg transition-colors hover:bg-white/10"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {error && (
                <div
                  className="p-3 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    color: '#dc2626',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingUser}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--christmas-cream)',
                    opacity: editingUser ? 0.6 : 1,
                  }}
                  placeholder="user@christmasair.com"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--christmas-cream)',
                  }}
                  placeholder="John Smith"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--christmas-cream)',
                  }}
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="owner">Owner</option>
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Department
                </label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--christmas-cream)',
                  }}
                >
                  <option value="">No department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Status (edit only) */}
              {editingUser && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="is_active" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Active account
                  </label>
                </div>
              )}

              {/* Permissions */}
              {formData.role !== 'owner' && (
                <div className="pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--christmas-cream)' }}>
                    Permissions
                  </h3>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                    Owners have all permissions. For other roles, grant specific permissions below.
                  </p>

                  <div className="space-y-4">
                    {APP_PERMISSIONS.map((group) => (
                      <div key={group.app}>
                        <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                          {group.label}
                        </div>
                        <div className="space-y-2">
                          {group.permissions.map((perm) => {
                            const isChecked =
                              (formData.permissions[group.app as keyof UserPermissions] as Record<string, boolean>)?.[
                                perm.key
                              ] === true;

                            return (
                              <label
                                key={perm.key}
                                className="flex items-start gap-3 cursor-pointer p-2 rounded-lg transition-colors hover:bg-white/5"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handlePermissionToggle(group.app, perm.key)}
                                  className="w-4 h-4 rounded mt-0.5"
                                />
                                <div>
                                  <div className="text-sm" style={{ color: 'var(--christmas-cream)' }}>
                                    {perm.label}
                                  </div>
                                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    {perm.description}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formData.role === 'owner' && (
                <div
                  className="p-3 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'rgba(184, 149, 107, 0.1)',
                    border: '1px solid rgba(184, 149, 107, 0.3)',
                    color: 'var(--christmas-gold)',
                  }}
                >
                  Owners have full access to all features and settings.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || (!editingUser && !formData.email)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--christmas-green)',
                  color: 'var(--christmas-cream)',
                  opacity: saving || (!editingUser && !formData.email) ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving...' : editingUser ? 'Save Changes' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
