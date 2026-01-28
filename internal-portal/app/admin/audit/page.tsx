'use client';

import { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import Link from 'next/link';

interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  actor?: {
    id: string;
    name: string | null;
    email: string;
  };
  target_user?: {
    id: string;
    name: string | null;
    email: string;
  };
}

const ACTION_LABELS: Record<string, string> = {
  'user.created': 'User Created',
  'user.updated': 'User Updated',
  'user.deactivated': 'User Deactivated',
  'user.reactivated': 'User Reactivated',
  'permission.changed': 'Permission Changed',
  'role.changed': 'Role Changed',
};

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  'user.created': { bg: 'rgba(34, 197, 94, 0.2)', text: '#22c55e' },
  'user.updated': { bg: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' },
  'user.deactivated': { bg: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' },
  'user.reactivated': { bg: 'rgba(34, 197, 94, 0.2)', text: '#22c55e' },
  'permission.changed': { bg: 'rgba(168, 85, 247, 0.2)', text: '#a855f7' },
  'role.changed': { bg: 'rgba(245, 158, 11, 0.2)', text: '#f59e0b' },
};

export default function AuditLogPage() {
  const { isOwner } = usePermissions();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAuditLog() {
      if (!isOwner) {
        setLoading(false);
        setError('You do not have permission to view the audit log');
        return;
      }

      try {
        const res = await fetch('/api/audit');
        if (!res.ok) {
          if (res.status === 403) {
            setError('You do not have permission to view the audit log');
            return;
          }
          throw new Error('Failed to fetch audit log');
        }
        const data = await res.json();
        setEntries(data.entries || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load audit log');
      } finally {
        setLoading(false);
      }
    }

    fetchAuditLog();
  }, [isOwner]);

  if (loading) {
    return (
      <div className="p-8">
        <p style={{ color: 'var(--text-muted)' }}>Loading audit log...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Audit Log
        </h1>
        <div
          className="p-4 rounded-lg"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center text-sm mb-4"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Admin
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Audit Log
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Track changes to users and permissions
        </p>
      </div>

      {entries.length === 0 ? (
        <div
          className="p-8 rounded-xl text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <p style={{ color: 'var(--text-muted)' }}>No audit entries yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const colors = ACTION_COLORS[entry.action] || { bg: 'rgba(107, 114, 128, 0.2)', text: '#6b7280' };

            return (
              <div
                key={entry.id}
                className="p-4 rounded-lg"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ background: colors.bg, color: colors.text }}
                      >
                        {ACTION_LABELS[entry.action] || entry.action}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-sm" style={{ color: 'var(--christmas-cream)' }}>
                      {entry.actor ? (
                        <>
                          <span className="font-medium">{entry.actor.name || entry.actor.email}</span>
                          {' '}
                        </>
                      ) : (
                        'System '
                      )}
                      {entry.action.replace('.', ' ')}
                      {entry.target_user && (
                        <>
                          {' '}
                          <span className="font-medium">{entry.target_user.name || entry.target_user.email}</span>
                        </>
                      )}
                    </p>

                    {/* Show changes for role/permission changes */}
                    {(entry.action === 'role.changed' || entry.action === 'permission.changed') && entry.old_value && entry.new_value && (
                      <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {entry.action === 'role.changed' && (
                          <span>
                            Role: {String(entry.old_value.role)} → {String(entry.new_value.role)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {entry.ip_address && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {entry.ip_address}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
