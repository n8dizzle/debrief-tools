'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AuditCheck {
  name: string;
  description: string;
  href: string;
  status: 'loading' | 'pass' | 'warning' | 'critical' | 'error';
  count?: number;
  detail?: string;
}

export default function DashboardPage() {
  const [checks, setChecks] = useState<AuditCheck[]>([
    {
      name: 'Open Jobs > 24h',
      description: 'Jobs stuck in In Progress, Dispatched, or Hold for over 24 hours',
      href: '/open-jobs',
      status: 'loading',
    },
    {
      name: 'Invoice Status',
      description: 'Pending and Posted invoices needing attention',
      href: '/invoice-status',
      status: 'loading',
    },
  ]);

  const updateCheck = (name: string, update: Partial<AuditCheck>) => {
    setChecks(prev => prev.map(c => c.name === name ? { ...c, ...update } : c));
  };

  useEffect(() => {
    // Run open jobs check
    fetch('/api/audit/open-jobs')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          updateCheck('Open Jobs > 24h', { status: 'error', detail: data.error });
          return;
        }
        const total = data.summary?.total || 0;
        const critical = data.summary?.critical || 0;
        let status: AuditCheck['status'] = 'pass';
        if (critical > 0) status = 'critical';
        else if (total > 0) status = 'warning';
        updateCheck('Open Jobs > 24h', {
          status,
          count: total,
          detail: total === 0 ? 'All clear' : `${total} job${total !== 1 ? 's' : ''} (${critical} critical)`,
        });
      })
      .catch(() => {
        updateCheck('Open Jobs > 24h', { status: 'error', detail: 'Failed to fetch' });
      });

    // Run invoice status check
    fetch('/api/audit/invoice-status')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          updateCheck('Invoice Status', { status: 'error', detail: data.error });
          return;
        }
        const pending = data.summary?.pending?.count || 0;
        const posted = data.summary?.posted?.count || 0;
        const total = pending + posted;
        const pendingTotal = data.summary?.pending?.total || 0;
        const postedTotal = data.summary?.posted?.total || 0;
        const dollarTotal = pendingTotal + postedTotal;

        let status: AuditCheck['status'] = 'pass';
        if (total > 10) status = 'critical';
        else if (total > 0) status = 'warning';

        const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
        updateCheck('Invoice Status', {
          status,
          count: total,
          detail: total === 0
            ? 'All clear'
            : `${fmt.format(dollarTotal)} across ${total} invoices`,
        });
      })
      .catch(() => {
        updateCheck('Invoice Status', { status: 'error', detail: 'Failed to fetch' });
      });
  }, []);

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    loading: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', label: 'Checking...' },
    pass: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', label: 'Pass' },
    warning: { bg: 'rgba(234, 179, 8, 0.15)', text: '#fcd34d', label: 'Warning' },
    critical: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', label: 'Critical' },
    error: { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af', label: 'Error' },
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Daily Audit
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          ServiceTitan data cleanliness checks
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {['pass', 'warning', 'critical'].map(status => {
          const count = checks.filter(c => c.status === status).length;
          const colors = statusColors[status];
          return (
            <div key={status} className="card">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: colors.bg }}
                >
                  <span className="text-lg font-bold" style={{ color: colors.text }}>
                    {count}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: colors.text }}>
                    {colors.label}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {count === 1 ? '1 check' : `${count} checks`}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Audit Checks */}
      <div className="space-y-3">
        {checks.map(check => {
          const colors = statusColors[check.status];
          return (
            <Link
              key={check.name}
              href={check.href}
              className="card block transition-colors"
              style={{ borderColor: check.status === 'critical' ? 'rgba(239, 68, 68, 0.3)' : undefined }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: colors.text }}
                  />
                  <div>
                    <h3 className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                      {check.name}
                    </h3>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {check.description}
                    </p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  {check.count !== undefined && (
                    <span className="text-2xl font-bold" style={{ color: colors.text }}>
                      {check.count}
                    </span>
                  )}
                  <span
                    className="badge text-xs"
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    {check.detail || colors.label}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
