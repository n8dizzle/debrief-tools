'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Setting {
  key: string;
  value: boolean | string;
  description: string;
}

interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  records_processed: number;
  records_created: number;
  records_updated: number;
  errors: string | null;
}

type SettingsTab = 'sync' | 'notifications';

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('sync');
  const [settings, setSettings] = useState<Setting[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<'auto-create' | 'sync-status' | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    fetchSettings();
    fetchSyncLogs();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncLogs = async () => {
    try {
      const response = await fetch('/api/sync/logs');
      if (response.ok) {
        const data = await response.json();
        setSyncLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch sync logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const updateSetting = async (key: string, value: boolean) => {
    setSaving(key);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });

      if (response.ok) {
        setSettings((prev) =>
          prev.map((s) => (s.key === key ? { ...s, value } : s))
        );
      }
    } catch (error) {
      console.error('Failed to update setting:', error);
    } finally {
      setSaving(null);
    }
  };

  const runSync = async (type: 'auto-create' | 'sync-status') => {
    setSyncing(type);
    try {
      const response = await fetch(`/api/sync/${type}`, {
        method: 'POST',
      });
      if (response.ok) {
        // Refresh logs after sync completes
        fetchSyncLogs();
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(null);
    }
  };

  const getSettingValue = (key: string): boolean => {
    const setting = settings.find((s) => s.key === key);
    if (!setting) return false;
    return setting.value === true || setting.value === 'true';
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-christmas-green" />
      </div>
    );
  }

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'sync', label: 'Data Sync' },
    { id: 'notifications', label: 'Notifications' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1">Sync configuration and system settings</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-lg bg-bg-secondary">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-christmas-green text-white'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Data Sync Tab */}
      {activeTab === 'sync' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Data Sync</h2>
            <div className="space-y-4">
              {/* Automatic Sync Info */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-bg-secondary">
                <div>
                  <div className="font-medium text-text-primary">Automatic Sync</div>
                  <div className="text-sm text-text-muted">
                    Auto-create: 8am CT weekdays • Status sync: 12pm CT daily
                  </div>
                </div>
                <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400">
                  Enabled
                </span>
              </div>

              {/* Manual Sync - Auto Create */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-bg-secondary">
                <div>
                  <div className="font-medium text-text-primary">Auto-Create Trackers</div>
                  <div className="text-sm text-text-muted">
                    Find new install jobs from ServiceTitan and create trackers
                  </div>
                </div>
                <button
                  onClick={() => runSync('auto-create')}
                  disabled={syncing !== null}
                  className="btn btn-primary"
                >
                  {syncing === 'auto-create' ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                      Running...
                    </span>
                  ) : (
                    'Run Sync'
                  )}
                </button>
              </div>

              {/* Manual Sync - Status */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-bg-secondary">
                <div>
                  <div className="font-medium text-text-primary">Sync Status</div>
                  <div className="text-sm text-text-muted">
                    Update tracker status from ServiceTitan jobs
                  </div>
                </div>
                <button
                  onClick={() => runSync('sync-status')}
                  disabled={syncing !== null}
                  className="btn btn-secondary"
                >
                  {syncing === 'sync-status' ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                      Running...
                    </span>
                  ) : (
                    'Run Sync'
                  )}
                </button>
              </div>

              {/* Integration Status */}
              <div className="mt-6 pt-6 border-t border-border-default">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Integration Status</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-bg-secondary">
                    <span className="text-sm text-text-secondary">Email (Resend)</span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                      Connected
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-bg-secondary">
                    <span className="text-sm text-text-secondary">SMS (Dialpad)</span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
                      Pending
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-bg-secondary">
                    <span className="text-sm text-text-secondary">ServiceTitan</span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                      Connected
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sync History */}
          <div className="card">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Sync History</h2>
            {logsLoading ? (
              <div className="text-center py-8 text-text-muted">Loading...</div>
            ) : syncLogs.length === 0 ? (
              <div className="text-center py-8 text-text-muted">No sync history yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="tracker-table">
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
                          <td className="capitalize text-sm">
                            {log.sync_type === 'auto_create' ? 'Auto Create' : 'Status Sync'}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                log.status === 'completed'
                                  ? 'badge-completed'
                                  : log.status === 'failed'
                                  ? 'badge-skipped'
                                  : 'badge-in-progress'
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="text-sm">{log.records_processed}</td>
                          <td className="text-sm">{log.records_created}</td>
                          <td className="text-sm">{log.records_updated}</td>
                          <td className="text-sm">
                            {log.errors ? (
                              <span className="text-red-400" title={log.errors}>
                                {log.errors.substring(0, 30)}...
                              </span>
                            ) : (
                              <span className="text-text-muted">-</span>
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
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          {/* Notification Queue Settings */}
          <div className="card">
            <h2 className="text-lg font-semibold text-text-primary mb-2">Notification Queue</h2>
            <p className="text-sm text-text-muted mb-4">
              Control when notifications are sent to customers
            </p>
            <div className="space-y-4">
              <ToggleSetting
                label="Require Queue Approval"
                description="All notifications must be manually approved before sending"
                enabled={getSettingValue('require_queue_approval')}
                onChange={(value) => updateSetting('require_queue_approval', value)}
                saving={saving === 'require_queue_approval'}
              />
            </div>
          </div>

          {/* Auto-Send Settings */}
          <div className="card">
            <h2 className="text-lg font-semibold text-text-primary mb-2">Auto-Send Notifications</h2>
            <p className="text-sm text-text-muted mb-4">
              When queue approval is disabled, these control automatic sending
            </p>
            <div className="space-y-4">
              <ToggleSetting
                label="Welcome Notifications"
                description="Automatically send welcome email/SMS when a tracker is created"
                enabled={getSettingValue('auto_send_welcome')}
                onChange={(value) => updateSetting('auto_send_welcome', value)}
                saving={saving === 'auto_send_welcome'}
                disabled={getSettingValue('require_queue_approval')}
              />
              <ToggleSetting
                label="Milestone Updates"
                description="Automatically notify customers when milestones are completed"
                enabled={getSettingValue('auto_send_milestone')}
                onChange={(value) => updateSetting('auto_send_milestone', value)}
                saving={saving === 'auto_send_milestone'}
                disabled={getSettingValue('require_queue_approval')}
              />
              <ToggleSetting
                label="Completion Notifications"
                description="Automatically send notification when job is marked complete"
                enabled={getSettingValue('auto_send_completion')}
                onChange={(value) => updateSetting('auto_send_completion', value)}
                saving={saving === 'auto_send_completion'}
                disabled={getSettingValue('require_queue_approval')}
              />
            </div>
            {getSettingValue('require_queue_approval') && (
              <p className="text-xs text-text-muted mt-4 p-3 bg-bg-secondary rounded-lg">
                These settings are disabled while "Require Queue Approval" is enabled.
                All notifications will go to the queue for manual review.
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

function ToggleSetting({
  label,
  description,
  enabled,
  onChange,
  saving,
  disabled,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  saving?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-4 bg-bg-secondary rounded-lg ${disabled ? 'opacity-50' : ''}`}>
      <div>
        <p className="font-medium text-text-primary">{label}</p>
        <p className="text-sm text-text-muted">{description}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled || saving}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-christmas-green' : 'bg-gray-600'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
        {saving && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full" />
          </span>
        )}
      </button>
    </div>
  );
}
