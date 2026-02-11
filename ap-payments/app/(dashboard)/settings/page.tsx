'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import { formatTimestamp } from '@/lib/ap-utils';

interface SyncLogEntry {
  id: string;
  sync_type: string;
  started_at: string;
  completed_at: string | null;
  jobs_processed: number;
  jobs_created: number;
  jobs_updated: number;
  errors: string | null;
  status: string;
}

type SettingsTab = 'sync';

export default function SettingsPage() {
  const { isManager, isOwner, canSyncData } = useAPPermissions();
  const [activeTab, setActiveTab] = useState<SettingsTab>('sync');

  // Sync settings state
  const [availableBUs, setAvailableBUs] = useState<string[]>([]);
  const [enabledBUs, setEnabledBUs] = useState<string[]>([]);
  const [savedBUs, setSavedBUs] = useState<string[]>([]);
  const [loadingBUs, setLoadingBUs] = useState(true);
  const [savingBUs, setSavingBUs] = useState(false);
  const [buSaveMessage, setBuSaveMessage] = useState('');

  // Sync history state
  const [syncHistory, setSyncHistory] = useState<SyncLogEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Manual sync
  const [syncing, setSyncing] = useState(false);

  const loadSyncSettings = useCallback(async () => {
    setLoadingBUs(true);
    try {
      const [availableRes, settingsRes] = await Promise.all([
        fetch('/api/settings/available-bus'),
        fetch('/api/settings/sync'),
      ]);

      if (availableRes.ok) {
        const names = await availableRes.json();
        setAvailableBUs(names);
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setEnabledBUs(data.enabled_business_units || []);
        setSavedBUs(data.enabled_business_units || []);
      }
    } catch (err) {
      console.error('Failed to load sync settings:', err);
    } finally {
      setLoadingBUs(false);
    }
  }, []);

  const loadSyncHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/settings/sync-history?limit=25');
      if (res.ok) {
        setSyncHistory(await res.json());
      }
    } catch (err) {
      console.error('Failed to load sync history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadSyncSettings();
    loadSyncHistory();
  }, [loadSyncSettings, loadSyncHistory]);

  const hasChanges = JSON.stringify([...enabledBUs].sort()) !== JSON.stringify([...savedBUs].sort());

  const handleSaveBUs = async () => {
    setSavingBUs(true);
    setBuSaveMessage('');
    try {
      const res = await fetch('/api/settings/sync', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled_business_units: enabledBUs }),
      });
      if (res.ok) {
        setSavedBUs([...enabledBUs]);
        setBuSaveMessage('Settings saved');
        setTimeout(() => setBuSaveMessage(''), 3000);
      } else {
        setBuSaveMessage('Failed to save');
      }
    } catch {
      setBuSaveMessage('Failed to save');
    } finally {
      setSavingBUs(false);
    }
  };

  const handleToggleBU = (bu: string) => {
    setEnabledBUs(prev =>
      prev.includes(bu) ? prev.filter(b => b !== bu) : [...prev, bu]
    );
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        await loadSyncHistory();
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return '—';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: 'sync', label: 'Data Sync' },
  ];

  if (!isManager && !isOwner) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: 'var(--text-muted)' }}>You don&apos;t have permission to access settings.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Settings
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2.5 text-sm font-medium transition-colors relative"
            style={{
              color: activeTab === tab.key ? 'var(--christmas-green-light)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.key ? '2px solid var(--christmas-green)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Data Sync Tab */}
      {activeTab === 'sync' && (
        <div className="space-y-6">
          {/* Auto Sync Config */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                  Sync Configuration
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Choose which ServiceTitan business units to include in the job sync.
                  Unchecked units will be excluded from future syncs.
                </p>
              </div>
            </div>

            {loadingBUs ? (
              <div className="flex items-center gap-2 py-4" style={{ color: 'var(--text-muted)' }}>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading business units...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                  {availableBUs.map(bu => {
                    const checked = enabledBUs.includes(bu);
                    const isPlumbing = bu.toLowerCase().includes('plumb');
                    return (
                      <label
                        key={bu}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                        style={{
                          background: checked ? 'var(--bg-card-hover)' : 'var(--bg-secondary)',
                          border: `1px solid ${checked ? 'var(--christmas-green-dark)' : 'var(--border-subtle)'}`,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleBU(bu)}
                          style={{ accentColor: 'var(--christmas-green)' }}
                        />
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {bu}
                        </span>
                        <span
                          className="ml-auto text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: isPlumbing ? 'rgba(184, 149, 107, 0.15)' : 'rgba(93, 138, 102, 0.15)',
                            color: isPlumbing ? 'var(--christmas-gold)' : 'var(--christmas-green-light)',
                          }}
                        >
                          {isPlumbing ? 'Plumbing' : 'HVAC'}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveBUs}
                    disabled={savingBUs || !hasChanges}
                    className="btn btn-primary"
                    style={{ opacity: savingBUs || !hasChanges ? 0.5 : 1 }}
                  >
                    {savingBUs ? 'Saving...' : 'Save Changes'}
                  </button>
                  {hasChanges && (
                    <button
                      onClick={() => setEnabledBUs([...savedBUs])}
                      className="btn btn-secondary text-sm"
                    >
                      Discard
                    </button>
                  )}
                  {buSaveMessage && (
                    <span
                      className="text-sm"
                      style={{ color: buSaveMessage === 'Settings saved' ? 'var(--status-success)' : 'var(--status-error)' }}
                    >
                      {buSaveMessage}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Manual Sync + Schedule Info */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                  Sync Schedule
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Jobs sync automatically every 2 hours during business hours (8am–6pm CT, Mon–Fri),
                  plus a daily full sync at 6am CT.
                </p>
              </div>
              {canSyncData && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="btn btn-primary"
                  style={{ opacity: syncing ? 0.6 : 1 }}
                >
                  {syncing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Syncing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Sync Now
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Sync History */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                Sync History
              </h2>
              <button
                onClick={loadSyncHistory}
                className="text-sm"
                style={{ color: 'var(--christmas-green-light)' }}
              >
                Refresh
              </button>
            </div>

            {loadingHistory ? (
              <div className="flex items-center gap-2 py-4" style={{ color: 'var(--text-muted)' }}>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading...
              </div>
            ) : syncHistory.length === 0 ? (
              <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>No sync history yet.</p>
            ) : (
              <div className="table-wrapper">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Status</th>
                      <th>Duration</th>
                      <th>Processed</th>
                      <th>Created</th>
                      <th>Updated</th>
                      <th>Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncHistory.map(entry => (
                      <tr key={entry.id}>
                        <td className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {formatTimestamp(entry.started_at)}
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor:
                                entry.status === 'completed' ? 'rgba(34, 197, 94, 0.15)' :
                                entry.status === 'running' ? 'rgba(59, 130, 246, 0.15)' :
                                'rgba(239, 68, 68, 0.15)',
                              color:
                                entry.status === 'completed' ? 'var(--status-success)' :
                                entry.status === 'running' ? 'var(--status-info)' :
                                'var(--status-error)',
                            }}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {formatDuration(entry.started_at, entry.completed_at)}
                        </td>
                        <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {entry.jobs_processed}
                        </td>
                        <td className="text-sm" style={{ color: 'var(--status-success)' }}>
                          {entry.jobs_created > 0 ? `+${entry.jobs_created}` : '0'}
                        </td>
                        <td className="text-sm" style={{ color: 'var(--status-info)' }}>
                          {entry.jobs_updated > 0 ? entry.jobs_updated : '0'}
                        </td>
                        <td className="text-sm">
                          {entry.errors ? (
                            <span
                              className="cursor-help"
                              title={entry.errors}
                              style={{ color: 'var(--status-error)' }}
                            >
                              Yes
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
