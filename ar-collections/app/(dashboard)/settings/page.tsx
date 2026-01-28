'use client';

import { useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/ar-utils';
import { ARSyncLog } from '@/lib/supabase';
import { useARPermissions } from '@/hooks/useARPermissions';

export default function SettingsPage() {
  const [syncLogs, setSyncLogs] = useState<ARSyncLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { canManageSettings, canRunManualSync, canRunBackfill, isOwner } = useARPermissions();

  useEffect(() => {
    fetchSyncLogs();
  }, []);

  async function fetchSyncLogs() {
    try {
      const response = await fetch('/api/sync/logs', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setSyncLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function runManualSync() {
    setSyncing(true);
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        fetchSyncLogs();
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setSyncing(false);
    }
  }

  if (!canManageSettings && !canRunManualSync) {
    return (
      <div className="card">
        <div className="text-center" style={{ color: 'var(--status-error)' }}>
          You do not have permission to access settings.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Settings
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Sync configuration and system settings
        </p>
      </div>

      {/* Sync Settings */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Data Sync
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div>
              <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                Automatic Sync
              </div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Daily at 6am CT + Hourly 8am-6pm Mon-Fri
              </div>
            </div>
            <span className="badge badge-current">Enabled</span>
          </div>

          {canRunManualSync && (
            <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div>
                <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                  Manual Sync
                </div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Sync invoices from ServiceTitan now
                </div>
              </div>
              <button
                onClick={runManualSync}
                disabled={syncing}
                className="btn btn-primary"
              >
                {syncing ? 'Syncing...' : 'Run Sync'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sync History */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Sync History
        </h2>
        {loading ? (
          <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : syncLogs.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            No sync history yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Processed</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.slice(0, 20).map((log) => {
                  const duration = log.completed_at
                    ? Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                    : null;
                  const durationStr = duration !== null
                    ? duration >= 60
                      ? `${Math.floor(duration / 60)}m ${duration % 60}s`
                      : `${duration}s`
                    : '-';
                  return (
                  <tr key={log.id}>
                    <td className="text-sm whitespace-nowrap">{formatDateTime(log.started_at)}</td>
                    <td className="text-sm">{durationStr}</td>
                    <td className="capitalize">{log.sync_type}</td>
                    <td>
                      <span className={`badge badge-${log.status === 'completed' ? 'current' : log.status === 'failed' ? '90' : '30'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td>{log.records_processed}</td>
                    <td>{log.records_created}</td>
                    <td>{log.records_updated}</td>
                    <td className="text-sm" style={{ color: log.errors ? 'var(--status-error)' : 'var(--text-muted)' }}>
                      {log.errors ? log.errors.substring(0, 50) + '...' : '-'}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Only Settings */}
      {isOwner && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Admin Settings
          </h2>
          <div className="space-y-4">
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div className="font-medium mb-2" style={{ color: 'var(--christmas-cream)' }}>
                Environment
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Supabase: </span>
                  <span style={{ color: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'var(--status-success)' : 'var(--status-error)' }}>
                    {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Connected' : 'Not configured'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>ServiceTitan: </span>
                  <span style={{ color: 'var(--status-success)' }}>Configured</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
