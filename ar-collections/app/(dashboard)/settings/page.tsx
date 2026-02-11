'use client';

import { useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/ar-utils';
import { ARSyncLog, ARSlackSettings, ARSlackNotificationLog, ARJobStatusOption, ARSTTaskSource, ARSTTaskType, ARSTTaskResolution } from '@/lib/supabase';
import { useARPermissions } from '@/hooks/useARPermissions';

type SettingsTab = 'sync' | 'notifications' | 'job-statuses' | 'st-tasks' | 'quickbooks' | 'admin';

const DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => ({
  value: i + 6,
  label: `${i + 6 > 12 ? i + 6 - 12 : i + 6}:00 ${i + 6 >= 12 ? 'PM' : 'AM'} CT`,
}));

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('sync');
  const [syncLogs, setSyncLogs] = useState<ARSyncLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { canManageSettings, canRunManualSync, isOwner } = useARPermissions();

  // Slack settings state
  const [slackSettings, setSlackSettings] = useState<ARSlackSettings>({
    weekly_slack_enabled: false,
    weekly_slack_day: 1,
    weekly_slack_hour: 6,
    slack_webhook_url: '',
  });
  const [lastSent, setLastSent] = useState<ARSlackNotificationLog | null>(null);
  const [slackLoading, setSlackLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [slackMessage, setSlackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showWebhook, setShowWebhook] = useState(false);

  // Job status management state
  const [jobStatuses, setJobStatuses] = useState<ARJobStatusOption[]>([]);
  const [jobStatusesLoading, setJobStatusesLoading] = useState(true);
  const [newStatusKey, setNewStatusKey] = useState('');
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [addingStatus, setAddingStatus] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [jobStatusMessage, setJobStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ST Task Config state
  const [stTaskSources, setStTaskSources] = useState<ARSTTaskSource[]>([]);
  const [stTaskTypes, setStTaskTypes] = useState<ARSTTaskType[]>([]);
  const [stTaskResolutions, setStTaskResolutions] = useState<ARSTTaskResolution[]>([]);
  const [stConfigLoading, setStConfigLoading] = useState(true);
  const [stConfigRefreshing, setStConfigRefreshing] = useState(false);
  const [stConfigLastFetched, setStConfigLastFetched] = useState<string | null>(null);
  const [stConfigMessage, setStConfigMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // QuickBooks state
  const [qbStatus, setQbStatus] = useState<{
    configured: boolean;
    connected: boolean;
    companyName: string | null;
    lastSync?: { completedAt: string } | null;
  } | null>(null);
  const [qbLoading, setQbLoading] = useState(true);
  const [qbMessage, setQbMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetchSyncLogs();
    if (canManageSettings) {
      fetchSlackSettings();
      fetchQBStatus();
    }
    if (isOwner) {
      fetchJobStatuses();
      fetchStTaskConfig();
    }
  }, [canManageSettings, isOwner]);

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

  async function fetchSlackSettings() {
    try {
      const response = await fetch('/api/settings/slack', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setSlackSettings(data.settings);
        setLastSent(data.lastSent);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setSlackLoading(false);
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

  async function updateSlackSettings(updates: Partial<ARSlackSettings>) {
    setSavingSettings(true);
    setSlackMessage(null);
    try {
      const response = await fetch('/api/settings/slack', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        setSlackSettings(prev => ({ ...prev, ...updates }));
        setSlackMessage({ type: 'success', text: 'Settings saved' });
      } else {
        setSlackMessage({ type: 'error', text: 'Failed to save settings' });
      }
    } catch (err) {
      console.error('Error:', err);
      setSlackMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSavingSettings(false);
      setTimeout(() => setSlackMessage(null), 3000);
    }
  }

  async function sendTestNotification() {
    setSendingTest(true);
    setSlackMessage(null);
    try {
      const response = await fetch('/api/settings/slack/test', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setSlackMessage({ type: 'success', text: 'Test notification sent to Slack!' });
      } else {
        setSlackMessage({ type: 'error', text: data.error || 'Failed to send test notification' });
      }
    } catch (err) {
      console.error('Error:', err);
      setSlackMessage({ type: 'error', text: 'Failed to send test notification' });
    } finally {
      setSendingTest(false);
      setTimeout(() => setSlackMessage(null), 5000);
    }
  }

  // Job status management functions
  async function fetchJobStatuses() {
    try {
      const response = await fetch('/api/settings/job-statuses?includeInactive=true', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setJobStatuses(data.statuses || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setJobStatusesLoading(false);
    }
  }

  async function addJobStatus() {
    if (!newStatusLabel.trim()) return;
    setAddingStatus(true);
    setJobStatusMessage(null);
    try {
      const key = newStatusKey.trim() || newStatusLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const response = await fetch('/api/settings/job-statuses', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, label: newStatusLabel.trim() }),
      });
      const data = await response.json();
      if (response.ok) {
        setJobStatuses(prev => [...prev, data.status]);
        setNewStatusKey('');
        setNewStatusLabel('');
        setJobStatusMessage({ type: 'success', text: 'Status added' });
      } else {
        setJobStatusMessage({ type: 'error', text: data.error || 'Failed to add status' });
      }
    } catch (err) {
      console.error('Error:', err);
      setJobStatusMessage({ type: 'error', text: 'Failed to add status' });
    } finally {
      setAddingStatus(false);
      setTimeout(() => setJobStatusMessage(null), 3000);
    }
  }

  async function updateJobStatus(id: string, updates: { label?: string; is_active?: boolean; control_bucket?: string | null }) {
    try {
      const response = await fetch('/api/settings/job-statuses', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      if (response.ok) {
        const data = await response.json();
        setJobStatuses(prev => prev.map(s => s.id === id ? data.status : s));
        setEditingStatusId(null);
        setJobStatusMessage({ type: 'success', text: 'Status updated' });
      }
    } catch (err) {
      console.error('Error:', err);
    }
    setTimeout(() => setJobStatusMessage(null), 3000);
  }

  async function moveStatus(id: string, direction: 'up' | 'down') {
    const currentIndex = jobStatuses.findIndex(s => s.id === id);
    if (currentIndex === -1) return;
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= jobStatuses.length) return;

    const newOrder = [...jobStatuses];
    const [moved] = newOrder.splice(currentIndex, 1);
    newOrder.splice(newIndex, 0, moved);
    setJobStatuses(newOrder);

    try {
      await fetch('/api/settings/job-statuses', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorder: newOrder.map(s => s.id) }),
      });
    } catch (err) {
      console.error('Error:', err);
    }
  }

  // ST Task Config functions
  async function fetchStTaskConfig() {
    try {
      const response = await fetch('/api/settings/st-task-config', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setStTaskSources(data.sources || []);
        setStTaskTypes(data.types || []);
        setStTaskResolutions(data.resolutions || []);
        setStConfigLastFetched(data.lastFetchedAt);
      }
    } catch (err) {
      console.error('Error fetching ST config:', err);
    } finally {
      setStConfigLoading(false);
    }
  }

  async function refreshStTaskConfig() {
    setStConfigRefreshing(true);
    setStConfigMessage(null);
    try {
      const response = await fetch('/api/settings/st-task-config/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setStTaskSources(data.sources || []);
        setStTaskTypes(data.types || []);
        setStTaskResolutions(data.resolutions || []);
        setStConfigLastFetched(data.lastFetchedAt);
        setStConfigMessage({ type: 'success', text: data.message || 'Config refreshed' });
      } else {
        setStConfigMessage({ type: 'error', text: data.error || 'Failed to refresh config' });
      }
    } catch (err) {
      console.error('Error refreshing ST config:', err);
      setStConfigMessage({ type: 'error', text: 'Failed to refresh config' });
    } finally {
      setStConfigRefreshing(false);
      setTimeout(() => setStConfigMessage(null), 5000);
    }
  }

  // QuickBooks functions
  async function fetchQBStatus() {
    try {
      const response = await fetch('/api/quickbooks/status', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setQbStatus(data);
      }
    } catch (err) {
      console.error('Error fetching QB status:', err);
    } finally {
      setQbLoading(false);
    }
  }

  async function connectQuickBooks() {
    try {
      const response = await fetch('/api/quickbooks/auth', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.authUrl;
      } else {
        const error = await response.json();
        setQbMessage({ type: 'error', text: error.error || 'Failed to connect' });
      }
    } catch (err) {
      setQbMessage({ type: 'error', text: 'Failed to connect to QuickBooks' });
    }
  }

  async function disconnectQuickBooks() {
    if (!confirm('Are you sure you want to disconnect QuickBooks? You will need to re-authenticate to sync payments again.')) {
      return;
    }
    setDisconnecting(true);
    setQbMessage(null);
    try {
      const response = await fetch('/api/quickbooks/disconnect', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        setQbStatus({ configured: true, connected: false, companyName: null });
        setQbMessage({ type: 'success', text: 'QuickBooks disconnected successfully' });
      } else {
        const error = await response.json();
        setQbMessage({ type: 'error', text: error.error || 'Failed to disconnect' });
      }
    } catch (err) {
      setQbMessage({ type: 'error', text: 'Failed to disconnect' });
    } finally {
      setDisconnecting(false);
      setTimeout(() => setQbMessage(null), 5000);
    }
  }

  // Handle QB OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qb = params.get('qb');
    const error = params.get('error');

    if (qb === 'connected') {
      setQbMessage({ type: 'success', text: 'Successfully connected to QuickBooks!' });
      fetchQBStatus();
      window.history.replaceState({}, '', '/settings');
      setActiveTab('quickbooks');
    } else if (error && activeTab === 'quickbooks') {
      setQbMessage({ type: 'error', text: `Connection error: ${error}` });
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  if (!canManageSettings && !canRunManualSync) {
    return (
      <div className="card">
        <div className="text-center" style={{ color: 'var(--status-error)' }}>
          You do not have permission to access settings.
        </div>
      </div>
    );
  }

  // Build tabs based on permissions
  const tabs: { id: SettingsTab; label: string; show: boolean }[] = [
    { id: 'sync', label: 'Data Sync', show: true },
    { id: 'notifications', label: 'Notifications', show: canManageSettings },
    { id: 'quickbooks', label: 'QuickBooks', show: canManageSettings },
    { id: 'job-statuses', label: 'Workflow', show: isOwner },
    { id: 'st-tasks', label: 'ST Tasks', show: isOwner },
    { id: 'admin', label: 'Admin', show: isOwner },
  ];

  const visibleTabs = tabs.filter(t => t.show);

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

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: activeTab === tab.id ? 'var(--christmas-green)' : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sync Settings */}
      {activeTab === 'sync' && (
      <div className="space-y-6">
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
                      <td
                        className="text-sm max-w-xs"
                        style={{ color: log.errors ? 'var(--status-error)' : 'var(--text-muted)' }}
                        title={log.errors || ''}
                      >
                        {log.errors ? (
                          <span className="block truncate">{log.errors}</span>
                        ) : '-'}
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

      {/* Weekly Slack Notification Settings */}
      {activeTab === 'notifications' && canManageSettings && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Weekly Slack Summary
          </h2>

          {slackMessage && (
            <div
              className="mb-4 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: slackMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: slackMessage.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
              }}
            >
              {slackMessage.text}
            </div>
          )}

          {slackLoading ? (
            <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : (
            <div className="space-y-4">
              {/* Webhook URL */}
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="font-medium mb-2" style={{ color: 'var(--christmas-cream)' }}>
                  Slack Webhook URL
                </div>
                <div className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
                  Create an incoming webhook in Slack and paste the URL here.{' '}
                  <a
                    href="https://api.slack.com/messaging/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--christmas-green)' }}
                  >
                    Learn how
                  </a>
                </div>
                <div className="flex gap-2">
                  <input
                    type={showWebhook ? 'text' : 'password'}
                    placeholder="https://hooks.slack.com/services/..."
                    value={slackSettings.slack_webhook_url}
                    onChange={(e) => setSlackSettings(prev => ({ ...prev, slack_webhook_url: e.target.value }))}
                    className="flex-1"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--christmas-cream)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                    }}
                  />
                  <button
                    onClick={() => setShowWebhook(!showWebhook)}
                    className="btn btn-secondary"
                    style={{ minWidth: '80px' }}
                  >
                    {showWebhook ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={() => updateSlackSettings({ slack_webhook_url: slackSettings.slack_webhook_url })}
                    disabled={savingSettings}
                    className="btn btn-primary"
                  >
                    {savingSettings ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div>
                  <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                    Weekly Notification
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Post AR dashboard summary to Slack
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={slackSettings.weekly_slack_enabled}
                    onChange={(e) => updateSlackSettings({ weekly_slack_enabled: e.target.checked })}
                    disabled={savingSettings || !slackSettings.slack_webhook_url}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-disabled:opacity-50"></div>
                </label>
              </div>

              {/* Schedule */}
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="font-medium mb-3" style={{ color: 'var(--christmas-cream)' }}>
                  Schedule
                </div>
                <div className="flex gap-4 flex-wrap">
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Day</label>
                    <select
                      value={slackSettings.weekly_slack_day}
                      onChange={(e) => updateSlackSettings({ weekly_slack_day: parseInt(e.target.value) })}
                      disabled={savingSettings}
                      className="form-select"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--christmas-cream)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                      }}
                    >
                      {DAY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Time</label>
                    <select
                      value={slackSettings.weekly_slack_hour}
                      onChange={(e) => updateSlackSettings({ weekly_slack_hour: parseInt(e.target.value) })}
                      disabled={savingSettings}
                      className="form-select"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--christmas-cream)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                      }}
                    >
                      {HOUR_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {lastSent && (
                  <div className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                    Last sent: {formatDateTime(lastSent.sent_at)}
                    {lastSent.status === 'failed' && (
                      <span style={{ color: 'var(--status-error)' }}> (failed)</span>
                    )}
                  </div>
                )}
              </div>

              {/* Test Notification */}
              <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div>
                  <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                    Test Notification
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Send a test message to your Slack channel
                  </div>
                </div>
                <button
                  onClick={sendTestNotification}
                  disabled={sendingTest || !slackSettings.slack_webhook_url}
                  className="btn btn-secondary"
                >
                  {sendingTest ? 'Sending...' : 'Send Test'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Job Status Management - Owner Only */}
      {activeTab === 'job-statuses' && isOwner && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Workflow Settings
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Manage status options and automation rules for invoice tracking.
          </p>

          {jobStatusMessage && (
            <div
              className="mb-4 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: jobStatusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: jobStatusMessage.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
              }}
            >
              {jobStatusMessage.text}
            </div>
          )}

          {jobStatusesLoading ? (
            <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Status List */}
              <div className="lg:col-span-2 space-y-4">
                {/* Active Statuses */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
                      Active ({jobStatuses.filter(s => s.is_active).length})
                    </span>
                  </div>
                  <div className="space-y-1">
                    {jobStatuses.filter(s => s.is_active).map((status, index) => (
                      <div
                        key={status.id}
                        className="flex items-center gap-2 p-2 rounded-lg group"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        {/* Reorder buttons */}
                        <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100">
                          <button
                            onClick={() => moveStatus(status.id, 'up')}
                            disabled={index === 0}
                            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => moveStatus(status.id, 'down')}
                            disabled={index === jobStatuses.filter(s => s.is_active).length - 1}
                            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>

                        {/* Position */}
                        <span className="w-6 text-center text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                          {index + 1}
                        </span>

                        {/* Label */}
                        <div className="flex-1">
                          {editingStatusId === status.id ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editingLabel}
                                onChange={(e) => setEditingLabel(e.target.value)}
                                className="flex-1 px-2 py-1 text-sm rounded"
                                style={{
                                  backgroundColor: 'var(--bg-tertiary)',
                                  color: 'var(--christmas-cream)',
                                  border: '1px solid var(--christmas-green)',
                                }}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') updateJobStatus(status.id, { label: editingLabel });
                                  if (e.key === 'Escape') setEditingStatusId(null);
                                }}
                              />
                              <button
                                onClick={() => updateJobStatus(status.id, { label: editingLabel })}
                                className="p-1 rounded hover:bg-green-500/20"
                                title="Save"
                              >
                                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setEditingStatusId(null)}
                                className="p-1 rounded hover:bg-red-500/20"
                                title="Cancel"
                              >
                                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--christmas-cream)' }}>{status.label}</span>
                          )}
                        </div>

                        {/* Control Bucket Linkage */}
                        <select
                          value={(status as any).control_bucket || ''}
                          onChange={(e) => updateJobStatus(status.id, { control_bucket: e.target.value || null })}
                          className="px-2 py-1 text-xs rounded"
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--christmas-cream)',
                            border: '1px solid var(--border-subtle)',
                            minWidth: '140px',
                          }}
                          title="Auto-set Actionable AR when this status is selected"
                        >
                          <option value="">No linkage</option>
                          <option value="ar_collectible">→ Actionable AR</option>
                          <option value="ar_not_in_our_control">→ Pending Closures</option>
                        </select>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100">
                          <button
                            onClick={() => {
                              setEditingStatusId(status.id);
                              setEditingLabel(status.label);
                            }}
                            className="p-1 rounded hover:bg-white/10"
                            title="Edit label"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => updateJobStatus(status.id, { is_active: false })}
                            className="p-1 rounded hover:bg-red-500/20"
                            title="Deactivate"
                          >
                            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inactive Statuses */}
                {jobStatuses.filter(s => !s.is_active).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                        Inactive ({jobStatuses.filter(s => !s.is_active).length})
                      </span>
                    </div>
                    <div className="space-y-1">
                      {jobStatuses.filter(s => !s.is_active).map((status) => (
                        <div
                          key={status.id}
                          className="flex items-center gap-2 p-2 rounded-lg group"
                          style={{ backgroundColor: 'var(--bg-secondary)', opacity: 0.6 }}
                        >
                          <span className="w-14"></span>
                          <span className="w-6"></span>
                          <span className="flex-1" style={{ color: 'var(--text-muted)' }}>{status.label}</span>
                          <button
                            onClick={() => updateJobStatus(status.id, { is_active: true })}
                            className="p-1 rounded hover:bg-green-500/20 opacity-50 group-hover:opacity-100"
                            title="Reactivate"
                          >
                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add New Status */}
                <div className="p-3 rounded-lg border-2 border-dashed" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add new status..."
                      value={newStatusLabel}
                      onChange={(e) => setNewStatusLabel(e.target.value)}
                      className="flex-1 px-3 py-2 rounded text-sm"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--christmas-cream)',
                        border: '1px solid var(--border-subtle)',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newStatusLabel.trim()) addJobStatus();
                      }}
                    />
                    <button
                      onClick={addJobStatus}
                      disabled={addingStatus || !newStatusLabel.trim()}
                      className="btn btn-primary px-4"
                    >
                      {addingStatus ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Preview */}
              <div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="text-sm font-medium mb-3" style={{ color: 'var(--christmas-cream)' }}>
                    Dropdown Preview
                  </div>
                  <div className="relative">
                    <select
                      className="w-full px-3 py-2 rounded text-sm appearance-none cursor-pointer"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--christmas-cream)',
                        border: '1px solid var(--border-subtle)',
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Select status...</option>
                      {jobStatuses.filter(s => s.is_active).map((status) => (
                        <option key={status.id} value={status.key}>{status.label}</option>
                      ))}
                    </select>
                    <svg
                      className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                    This is how the dropdown appears on invoice detail pages.
                  </p>
                </div>

                {/* Tips */}
                <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="text-sm font-medium mb-2" style={{ color: 'var(--christmas-cream)' }}>
                    Tips
                  </div>
                  <ul className="text-xs space-y-2" style={{ color: 'var(--text-muted)' }}>
                    <li className="flex gap-2">
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      Use arrows to reorder statuses
                    </li>
                    <li className="flex gap-2">
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Click pencil to edit label
                    </li>
                    <li className="flex gap-2">
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Deactivate to hide from dropdown
                    </li>
                    <li className="flex gap-2">
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Use linkage dropdown to auto-set Actionable AR
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ServiceTitan Tasks Config - Owner Only */}
      {activeTab === 'st-tasks' && isOwner && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                ServiceTitan Task Integration
              </h2>
              <button
                onClick={refreshStTaskConfig}
                disabled={stConfigRefreshing}
                className="btn btn-secondary btn-sm"
              >
                {stConfigRefreshing ? 'Refreshing...' : 'Refresh from ST'}
              </button>
            </div>

            {stConfigMessage && (
              <div
                className="mb-4 p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: stConfigMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: stConfigMessage.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
                }}
              >
                {stConfigMessage.text}
              </div>
            )}

            {stConfigLoading ? (
              <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>Loading...</div>
            ) : (
              <div className="space-y-4">
                {/* Status info */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Task Sources</div>
                      <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {stTaskSources.length} available
                      </div>
                    </div>
                    <div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Task Types</div>
                      <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {stTaskTypes.length} available
                      </div>
                    </div>
                    <div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Resolutions</div>
                      <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {stTaskResolutions.length} available
                      </div>
                    </div>
                    <div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Last Fetched</div>
                      <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {stConfigLastFetched ? formatDateTime(stConfigLastFetched) : 'Never'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Help text */}
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Task types are synced from ServiceTitan. When creating tasks,
                  you can select from these types directly.
                </p>
              </div>
            )}
          </div>

          {/* Available Task Types */}
          <div className="card">
            <h3 className="text-md font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              Available Task Types ({stTaskTypes.length})
            </h3>

            {stTaskTypes.length === 0 ? (
              <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>
                No task types loaded. Click &quot;Refresh from ST&quot; to load.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stTaskTypes.map(type => (
                  <span
                    key={type.st_type_id}
                    className="px-3 py-1 rounded-full text-sm"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                  >
                    {type.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QuickBooks Integration Settings */}
      {activeTab === 'quickbooks' && canManageSettings && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            QuickBooks Integration
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Connect QuickBooks Online to track payments from collection through bank deposit.
          </p>

          {qbMessage && (
            <div
              className="mb-4 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: qbMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: qbMessage.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
              }}
            >
              {qbMessage.text}
            </div>
          )}

          {qbLoading ? (
            <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : qbStatus?.connected ? (
            <div className="space-y-4">
              {/* Connected Status */}
              <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)' }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="var(--christmas-green)" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                      Connected to QuickBooks
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {qbStatus.companyName || 'Company connected'}
                    </div>
                  </div>
                </div>
                <span className="badge badge-current">Active</span>
              </div>

              {/* Last Sync */}
              {qbStatus.lastSync && (
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>Last synced: </span>
                    <span style={{ color: 'var(--christmas-cream)' }}>
                      {formatDateTime(qbStatus.lastSync.completedAt)}
                    </span>
                  </div>
                </div>
              )}

              {/* Disconnect */}
              {isOwner && (
                <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div>
                    <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                      Disconnect QuickBooks
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Remove the QuickBooks connection from this account
                    </div>
                  </div>
                  <button
                    onClick={disconnectQuickBooks}
                    disabled={disconnecting}
                    className="btn"
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-error)' }}
                  >
                    {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Not Connected */}
              <div className="p-6 rounded-lg text-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <svg
                  className="w-12 h-12 mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--christmas-cream)' }}>
                  Not Connected
                </h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                  Connect your QuickBooks Online account to sync payments and track deposits.
                </p>
                <button onClick={connectQuickBooks} className="btn btn-primary">
                  Connect QuickBooks
                </button>
              </div>

              {/* What You Get */}
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="font-medium mb-3" style={{ color: 'var(--christmas-cream)' }}>
                  What you get with QuickBooks integration:
                </div>
                <ul className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    See payments stuck in &quot;Undeposited Funds&quot;
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Auto-match QB payments to ServiceTitan invoices
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Track payment reconciliation from collection to bank
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Identify discrepancies between systems
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Admin Only Settings */}
      {activeTab === 'admin' && isOwner && (
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
