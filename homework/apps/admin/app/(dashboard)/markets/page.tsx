'use client';

import { useState } from 'react';

interface Market {
  id: string;
  name: string;
  state: string;
  zipCodes: number;
  contractors: number;
  services: number;
  orders: number;
  status: 'active' | 'coming_soon' | 'paused';
  launchDate: string;
}

const markets: Market[] = [
  { id: '1', name: 'Austin', state: 'TX', zipCodes: 45, contractors: 28, services: 42, orders: 856, status: 'active', launchDate: '2025-09-01' },
  { id: '2', name: 'Round Rock', state: 'TX', zipCodes: 12, contractors: 14, services: 35, orders: 218, status: 'active', launchDate: '2025-10-15' },
  { id: '3', name: 'Cedar Park', state: 'TX', zipCodes: 8, contractors: 9, services: 28, orders: 134, status: 'active', launchDate: '2025-11-01' },
  { id: '4', name: 'Pflugerville', state: 'TX', zipCodes: 6, contractors: 7, services: 22, orders: 76, status: 'active', launchDate: '2025-12-01' },
  { id: '5', name: 'Dripping Springs', state: 'TX', zipCodes: 4, contractors: 4, services: 15, orders: 0, status: 'coming_soon', launchDate: '2026-03-01' },
  { id: '6', name: 'Georgetown', state: 'TX', zipCodes: 8, contractors: 0, services: 0, orders: 0, status: 'coming_soon', launchDate: '2026-04-01' },
  { id: '7', name: 'San Marcos', state: 'TX', zipCodes: 5, contractors: 0, services: 0, orders: 0, status: 'coming_soon', launchDate: '2026-Q2' },
];

export default function MarketsPage() {
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = markets.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    return true;
  });

  const statusBadge = (status: Market['status']) => {
    const map = {
      active: { className: 'badge-green', label: 'Active' },
      coming_soon: { className: 'badge-yellow', label: 'Coming Soon' },
      paused: { className: 'badge-gray', label: 'Paused' },
    };
    const s = map[status];
    return <span className={`badge ${s.className}`}>{s.label}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--admin-text)]">Markets</h1>
          <p className="text-sm text-[var(--admin-text-muted)] mt-1">
            Geographic coverage and zip code management
          </p>
        </div>
        <button className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Market
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <p className="stat-label">Active Markets</p>
          <p className="stat-value">{markets.filter((m) => m.status === 'active').length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Total Zip Codes</p>
          <p className="stat-value">{markets.reduce((sum, m) => sum + m.zipCodes, 0)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Total Contractors</p>
          <p className="stat-value">{markets.reduce((sum, m) => sum + m.contractors, 0)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Coming Soon</p>
          <p className="stat-value">{markets.filter((m) => m.status === 'coming_soon').length}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="admin-select"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="coming_soon">Coming Soon</option>
          <option value="paused">Paused</option>
        </select>
      </div>

      {/* Market Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((m) => (
          <div key={m.id} className="admin-card admin-card-hover cursor-pointer">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--admin-text)]">{m.name}</h3>
                <p className="text-xs text-[var(--admin-text-muted)]">{m.state}</p>
              </div>
              {statusBadge(m.status)}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="p-2.5 rounded-lg bg-[var(--admin-surface)]">
                <p className="text-xs text-[var(--admin-text-muted)]">Zip Codes</p>
                <p className="text-lg font-bold text-[var(--admin-text)]">{m.zipCodes}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--admin-surface)]">
                <p className="text-xs text-[var(--admin-text-muted)]">Contractors</p>
                <p className="text-lg font-bold text-[var(--admin-text)]">{m.contractors}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--admin-surface)]">
                <p className="text-xs text-[var(--admin-text-muted)]">Services</p>
                <p className="text-lg font-bold text-[var(--admin-text)]">{m.services}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--admin-surface)]">
                <p className="text-xs text-[var(--admin-text-muted)]">Orders</p>
                <p className="text-lg font-bold text-[var(--admin-text)]">{m.orders.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--admin-border)]">
              <span className="text-xs text-[var(--admin-text-muted)]">
                {m.status === 'active' ? `Launched ${m.launchDate}` : `Planned ${m.launchDate}`}
              </span>
              <button className="text-xs text-primary hover:text-primary-light transition-colors">
                Manage
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
