'use client';

import { useState, useEffect } from 'react';
import { useLaborPermissions } from '@/hooks/useLaborPermissions';
import { formatTimestamp } from '@/lib/labor-utils';
import type { LaborSyncLog } from '@/lib/supabase';

export default function SettingsPage() {
  const { canSyncData } = useLaborPermissions();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<LaborSyncLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/sync-history');
      if (res.ok) {
        const json = await res.json();
        setSyncLogs(json.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch sync logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSync = async (days: number) => {
    if (!canSyncData) return;
    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch(`/api/cron/sync?days=${days}`, { method: 'POST' });
      const json = await res.json();

      if (res.ok) {
        setSyncResult(`Sync complete: ${json.gross_pay_items || 0} pay items, ${json.adjustments || 0} adjustments, ${json.employees || 0} employees`);
        fetchLogs();
      } else {
        setSyncResult(`Sync failed: ${json.error || 'Unknown error'}`);
      }
    } catch (err) {
      setSyncResult(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

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
          Pull payroll data from ServiceTitan. Full sync fetches 90 days of data; incremental fetches the last 7 days.
        </p>

        {canSyncData ? (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleSync(7)}
              disabled={syncing}
              className="btn btn-primary"
            >
              {syncing ? 'Syncing...' : 'Incremental Sync (7 days)'}
            </button>
            <button
              onClick={() => handleSync(90)}
              disabled={syncing}
              className="btn btn-secondary"
            >
              {syncing ? 'Syncing...' : 'Full Sync (90 days)'}
            </button>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Only managers and owners can trigger syncs.
          </p>
        )}

        {syncResult && (
          <div
            className="mt-4 p-3 rounded-lg text-sm"
            style={{
              background: syncResult.includes('failed')
                ? 'rgba(139, 45, 50, 0.15)'
                : 'rgba(93, 138, 102, 0.15)',
              color: syncResult.includes('failed')
                ? '#c97878'
                : 'var(--christmas-green-light)',
            }}
          >
            {syncResult}
          </div>
        )}
      </div>

      {/* Sync History */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Sync History
        </h2>

        {loadingLogs ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto" style={{ borderColor: 'var(--christmas-green)' }} />
          </div>
        ) : syncLogs.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No sync history yet. Run a sync to get started.
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="labor-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th className="text-right">Processed</th>
                  <th className="text-right">Created</th>
                  <th>Duration</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.map((log) => {
                  const duration = log.started_at && log.completed_at
                    ? Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                    : null;

                  return (
                    <tr key={log.id}>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {formatTimestamp(log.started_at)}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: log.sync_type === 'full'
                              ? 'rgba(93, 138, 102, 0.15)'
                              : 'rgba(184, 149, 107, 0.15)',
                            color: log.sync_type === 'full'
                              ? 'var(--christmas-green-light)'
                              : 'var(--christmas-gold)',
                          }}
                        >
                          {log.sync_type}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: log.status === 'completed'
                              ? 'rgba(34, 197, 94, 0.15)'
                              : log.status === 'running'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                            color: log.status === 'completed'
                              ? 'var(--status-success)'
                              : log.status === 'running'
                              ? 'var(--status-info)'
                              : 'var(--status-error)',
                          }}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="text-right" style={{ color: 'var(--text-secondary)' }}>
                        {log.items_processed.toLocaleString()}
                      </td>
                      <td className="text-right" style={{ color: 'var(--text-secondary)' }}>
                        {log.items_created.toLocaleString()}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {duration !== null ? `${duration}s` : '\u2014'}
                      </td>
                      <td>
                        {log.errors ? (
                          <span className="text-xs" style={{ color: 'var(--status-error)' }} title={log.errors}>
                            {log.errors.length > 50 ? log.errors.slice(0, 50) + '...' : log.errors}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>{'\u2014'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
