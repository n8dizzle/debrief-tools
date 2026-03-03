'use client';

import { useState, useEffect } from 'react';
import { usePayrollPermissions } from '@/hooks/usePayrollPermissions';
import { formatTimestamp } from '@/lib/payroll-utils';

interface SyncLogEntry {
  id: string;
  sync_type: string | null;
  started_at: string | null;
  completed_at: string | null;
  records_processed: number;
  records_created: number;
  records_updated: number;
  errors: string | null;
  status: string | null;
}

export default function SettingsPage() {
  const { canSyncData, isManager, isOwner } = usePayrollPermissions();
  const [syncHistory, setSyncHistory] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/sync-history');
      if (res.ok) {
        const data = await res.json();
        setSyncHistory(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load sync history:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/cron/sync', { method: 'POST' });
      await loadHistory();
    } finally {
      setSyncing(false);
    }
  };

  if (!isManager && !isOwner) {
    return (
      <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
        You don't have permission to view settings.
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--christmas-cream)' }}>
        Settings
      </h1>

      {/* Sync Controls */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Data Sync
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Payroll data syncs automatically from ServiceTitan every 2 hours during business hours (Mon-Fri 8am-4pm)
          and daily at 6am. You can also trigger a manual sync below.
        </p>
        <div className="flex items-center gap-4">
          {canSyncData && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn btn-primary gap-2"
            >
              {syncing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Run Manual Sync
                </>
              )}
            </button>
          )}
          {syncHistory.length > 0 && syncHistory[0].completed_at && (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Last sync: {formatTimestamp(syncHistory[0].completed_at)}
            </span>
          )}
        </div>
      </div>

      {/* Sync History */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>Sync History</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="w-6 h-6 animate-spin" style={{ color: 'var(--christmas-green)' }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="pr-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th className="text-right">Processed</th>
                  <th className="text-right">Created</th>
                  <th className="text-right">Updated</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {syncHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                      No sync history yet
                    </td>
                  </tr>
                ) : (
                  syncHistory.map(log => {
                    const duration = log.started_at && log.completed_at
                      ? `${((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000).toFixed(1)}s`
                      : '-';

                    return (
                      <tr key={log.id}>
                        <td>{log.started_at ? formatTimestamp(log.started_at) : '-'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{duration}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: log.status === 'success' ? 'rgba(34, 197, 94, 0.15)' :
                                log.status === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: log.status === 'success' ? 'var(--status-success)' :
                                log.status === 'error' ? 'var(--status-error)' : 'var(--status-info)',
                            }}
                          >
                            {log.status || 'unknown'}
                          </span>
                        </td>
                        <td className="text-right">{log.records_processed}</td>
                        <td className="text-right" style={{ color: 'var(--status-success)' }}>{log.records_created}</td>
                        <td className="text-right">{log.records_updated}</td>
                        <td style={{ color: 'var(--status-error)', maxWidth: '200px' }} className="truncate">
                          {log.errors || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
