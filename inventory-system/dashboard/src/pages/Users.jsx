/**
 * Users — admin user management page.
 *
 * Features:
 *  - User list with search, role filter, department filter, active toggle
 *  - Edit user slide-over (name, email, phone, role, dept, active)
 *  - Invite user modal (creates new account)
 *  - Role badges, assigned truck chip, avatar initials
 */

import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Users as UsersIcon, Plus, Search, X, ChevronDown,
  Mail, Phone, Truck, Shield, UserCheck, UserX,
  AlertTriangle, CheckCircle, Edit3, Filter,
} from 'lucide-react';
import { Spinner } from '../components/ui/Spinner.jsx';
import client from '../api/client.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLES   = ['all', 'admin', 'manager', 'tech'];
const DEPTS   = ['all', 'plumbing', 'hvac'];
const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', tech: 'Tech', all: 'All Depts' };

const ROLE_STYLES = {
  admin:   'bg-purple-500/15 text-purple-300 border-purple-500/30',
  manager: 'bg-amber-500/15  text-amber-300  border-amber-500/30',
  tech:    'bg-blue-500/15   text-blue-300   border-blue-500/30',
};

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize
                      ${ROLE_STYLES[role] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
      {role}
    </span>
  );
}

function Avatar({ name, size = 'md' }) {
  const initials = name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '??';
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm';
  const colors = ['bg-indigo-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600', 'bg-violet-600'];
  const color  = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────────
function Header({ total, onInvite, collapsed, onToggleSidebar }) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="text-slate-400 hover:text-slate-600 transition-colors md:hidden"
        >
          <Filter size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <UsersIcon size={20} className="text-slate-400" />
            <h1 className="text-lg font-bold text-slate-800">User Management</h1>
            <span className="bg-slate-100 text-slate-500 text-xs font-semibold px-2 py-0.5 rounded-full">
              {total}
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">Manage accounts, roles, and truck assignments</p>
        </div>
        <button
          onClick={onInvite}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus size={16} />
          Invite User
        </button>
      </div>
    </div>
  );
}

// ── Toolbar (search + filters) ─────────────────────────────────────────────────
function Toolbar({ search, setSearch, role, setRole, dept, setDept, showInactive, setShowInactive }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-4 bg-white border-b border-slate-100">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full border border-slate-200 rounded-lg pl-9 pr-9 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Role filter */}
      <div className="relative">
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className="appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white capitalize"
        >
          {ROLES.map(r => <option key={r} value={r}>{r === 'all' ? 'All Roles' : ROLE_LABELS[r]}</option>)}
        </select>
        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>

      {/* Department filter */}
      <div className="relative">
        <select
          value={dept}
          onChange={e => setDept(e.target.value)}
          className="appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white capitalize"
        >
          {DEPTS.map(d => <option key={d} value={d}>{d === 'all' ? 'All Depts' : d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
        </select>
        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>

      {/* Show inactive toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div
          onClick={() => setShowInactive(v => !v)}
          className={`relative w-9 h-5 rounded-full transition-colors ${showInactive ? 'bg-indigo-600' : 'bg-slate-300'}`}
        >
          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showInactive ? 'translate-x-4' : ''}`} />
        </div>
        <span className="text-sm text-slate-600">Show inactive</span>
      </label>
    </div>
  );
}

// ── User row ───────────────────────────────────────────────────────────────────
function UserRow({ user, onEdit }) {
  return (
    <tr
      onClick={() => onEdit(user)}
      className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors
                  ${!user.active ? 'opacity-50' : ''}`}
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} />
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">{user.name}</p>
            <p className="text-slate-500 text-xs truncate flex items-center gap-1">
              <Mail size={10} className="flex-shrink-0" />{user.email}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-4 py-4">
        <span className="text-sm text-slate-600 capitalize">{user.department === 'all' ? '—' : user.department}</span>
      </td>
      <td className="px-4 py-4">
        {user.truck ? (
          <div className="flex items-center gap-1.5 text-sm text-slate-700">
            <Truck size={13} className="text-indigo-400 flex-shrink-0" />
            <span className="font-medium">#{user.truck.truck_number}</span>
          </div>
        ) : (
          <span className="text-slate-400 text-xs">Unassigned</span>
        )}
      </td>
      <td className="px-4 py-4">
        {user.phone ? (
          <span className="text-slate-500 text-xs flex items-center gap-1">
            <Phone size={10} />{user.phone}
          </span>
        ) : <span className="text-slate-300 text-xs">—</span>}
      </td>
      <td className="px-4 py-4">
        {user.active ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <CheckCircle size={10} /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
            <UserX size={10} /> Inactive
          </span>
        )}
      </td>
      <td className="px-4 py-4">
        <span className="text-slate-400 text-xs">{new Date(user.created_at).toLocaleDateString()}</span>
      </td>
      <td className="px-4 py-4">
        <button
          onClick={e => { e.stopPropagation(); onEdit(user); }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          <Edit3 size={15} />
        </button>
      </td>
    </tr>
  );
}

// ── Edit slide-over ────────────────────────────────────────────────────────────
function EditSlideOver({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:       user.name,
    email:      user.email,
    phone:      user.phone ?? '',
    role:       user.role,
    department: user.department,
    active:     user.active,
  });
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);
  const [deactConfirm, setDeactConfirm] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function save(e) {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const { data } = await client.patch(`/users/${user.id}`, form);
      onSaved(data.user);
      setSuccess(true);
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (form.active && !deactConfirm) { setDeactConfirm(true); return; }
    setDeactConfirm(false);
    const newActive = !form.active;
    set('active', newActive);
    try {
      const { data } = await client.patch(`/users/${user.id}`, { active: newActive });
      onSaved(data.user);
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-white flex flex-col shadow-2xl h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size="lg" />
            <div>
              <h2 className="font-bold text-slate-800">{user.name}</h2>
              <p className="text-slate-400 text-xs">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={save} className="flex flex-col flex-1 px-6 py-6 gap-5">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="e.g. 972-555-0100"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>

          {/* Role + Department */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Role</label>
              <div className="relative">
                <select
                  value={form.role}
                  onChange={e => set('role', e.target.value)}
                  className="w-full appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="tech">Tech</option>
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Department</label>
              <div className="relative">
                <select
                  value={form.department}
                  onChange={e => set('department', e.target.value)}
                  className="w-full appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white capitalize"
                >
                  <option value="all">All / Admin</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="hvac">HVAC</option>
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Assigned truck (read-only info) */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 px-4 py-3">
            <p className="text-xs font-medium text-slate-500 mb-1">Assigned Truck</p>
            {user.truck ? (
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Truck size={14} className="text-indigo-500" />
                <span className="font-semibold">Truck #{user.truck.truck_number}</span>
                <span className="text-slate-400 capitalize">· {user.truck.department}</span>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No truck assigned — set from the Trucks page.</p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
              <AlertTriangle size={15} className="flex-shrink-0" />{error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">
              <CheckCircle size={15} className="flex-shrink-0" />Saved!
            </div>
          )}

          {/* Actions */}
          <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-3">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg py-2.5 font-semibold text-sm transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>

            {user.id !== 'usr-1' && (
              <>
                {deactConfirm ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                    <p className="text-red-700 font-medium mb-2">Deactivate this user?</p>
                    <p className="text-red-500 text-xs mb-3">They will lose access immediately.</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setDeactConfirm(false)} className="flex-1 bg-white border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-medium">
                        Cancel
                      </button>
                      <button type="button" onClick={toggleActive} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold">
                        Deactivate
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={toggleActive}
                    className={`w-full border rounded-lg py-2.5 font-semibold text-sm transition-colors flex items-center justify-center gap-2
                      ${form.active
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                      }`}
                  >
                    {form.active ? <><UserX size={15} /> Deactivate User</> : <><UserCheck size={15} /> Reactivate User</>}
                  </button>
                )}
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Invite modal ───────────────────────────────────────────────────────────────
function InviteModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'tech', department: 'plumbing', phone: '' });
  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { setError('Name and email are required.'); return; }
    setError(''); setSaving(true);
    try {
      const { data } = await client.post('/users', { ...form, password: 'changeme123' });
      onCreated(data.user);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Could not create user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-slate-800">Invite New User</h2>
            <p className="text-slate-400 text-xs mt-0.5">Default password: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">changeme123</code></p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Full Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. John Smith"
              autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Email Address *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="e.g. john@christmasair.com"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="e.g. 972-555-0100"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Role *</label>
              <div className="relative">
                <select
                  value={form.role}
                  onChange={e => set('role', e.target.value)}
                  className="w-full appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="tech">Tech</option>
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Department *</label>
              <div className="relative">
                <select
                  value={form.department}
                  onChange={e => set('department', e.target.value)}
                  className="w-full appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white capitalize"
                >
                  <option value="all">All / Admin</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="hvac">HVAC</option>
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
              <AlertTriangle size={15} className="flex-shrink-0" />{error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2.5 font-semibold text-sm hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg py-2.5 font-semibold text-sm transition-colors">
              {saving ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────────────
function StatsBar({ users }) {
  const active  = users.filter(u => u.active).length;
  const admins  = users.filter(u => u.role === 'admin').length;
  const managers = users.filter(u => u.role === 'manager').length;
  const techs   = users.filter(u => u.role === 'tech').length;
  const withTruck = users.filter(u => u.truck).length;

  const stats = [
    { label: 'Active Users', value: active,    color: 'text-emerald-600' },
    { label: 'Admins',       value: admins,     color: 'text-purple-600'  },
    { label: 'Managers',     value: managers,   color: 'text-amber-600'   },
    { label: 'Technicians',  value: techs,      color: 'text-blue-600'    },
    { label: 'With Truck',   value: withTruck,  color: 'text-indigo-600'  },
  ];

  return (
    <div className="grid grid-cols-5 border-b border-slate-200 bg-white divide-x divide-slate-100">
      {stats.map(s => (
        <div key={s.label} className="px-6 py-4 text-center">
          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function Empty({ hasFilter }) {
  return (
    <tr>
      <td colSpan={8} className="py-16 text-center">
        <UsersIcon size={32} className="text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">No users found</p>
        <p className="text-slate-400 text-sm mt-1">
          {hasFilter ? 'Try adjusting your filters.' : 'Invite a user to get started.'}
        </p>
      </td>
    </tr>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Users() {
  const { collapsed, onToggleSidebar } = useOutletContext() ?? {};

  const [allUsers,   setAllUsers]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  // Filters
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState('all');
  const [deptFilter,   setDeptFilter]   = useState('all');
  const [showInactive, setShowInactive] = useState(false);

  // Modals
  const [editUser,   setEditUser]   = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await client.get('/users');
      setAllUsers(data.users ?? []);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Client-side filtering
  const filtered = allUsers.filter(u => {
    if (!showInactive && !u.active) return false;
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (deptFilter !== 'all' && u.department !== deptFilter && u.department !== 'all') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function handleSaved(updated) {
    setAllUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
  }

  function handleCreated(newUser) {
    setAllUsers(prev => [newUser, ...prev]);
  }

  const hasFilter = search || roleFilter !== 'all' || deptFilter !== 'all';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        total={allUsers.filter(u => u.active).length}
        onInvite={() => setInviteOpen(true)}
        collapsed={collapsed}
        onToggleSidebar={onToggleSidebar}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Stats */}
        {!loading && allUsers.length > 0 && <StatsBar users={allUsers} />}

        {/* Toolbar */}
        <Toolbar
          search={search}        setSearch={setSearch}
          role={roleFilter}      setRole={setRoleFilter}
          dept={deptFilter}      setDept={setDeptFilter}
          showInactive={showInactive} setShowInactive={setShowInactive}
        />

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" className="text-indigo-500" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 mx-6 mt-6 bg-red-50 border border-red-200 text-red-600 rounded-xl px-5 py-4 text-sm">
            <AlertTriangle size={16} className="flex-shrink-0" />{error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Dept</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Truck</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white">
                {filtered.length === 0
                  ? <Empty hasFilter={hasFilter} />
                  : filtered.map(u => (
                      <UserRow key={u.id} user={u} onEdit={setEditUser} />
                    ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {editUser && (
        <EditSlideOver
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={updated => { handleSaved(updated); setEditUser(u => ({ ...u, ...updated })); }}
        />
      )}
      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
