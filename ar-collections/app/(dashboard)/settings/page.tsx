'use client';

import { useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/ar-utils';
import { ARSyncLog, ARSlackSettings, ARSlackNotificationLog, ARJobStatusOption } from '@/lib/supabase';
import { useARPermissions } from '@/hooks/useARPermissions';

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

  useEffect(() => {
    fetchSyncLogs();
    if (canManageSettings) {
      fetchSlackSettings();
    }
    if (isOwner) {
      fetchJobStatuses();
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

  async function updateJobStatus(id: string, updates: { label?: string; is_active?: boolean }) {
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

      {/* Weekly Slack Notification Settings */}
      {canManageSettings && (
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
      {isOwner && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Job Status Options
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Manage the dropdown options for job status on invoices.
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
            <div className="space-y-4">
              {/* Status List */}
              <div className="space-y-2">
                {jobStatuses.map((status, index) => (
                  <div
                    key={status.id}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      opacity: status.is_active ? 1 : 0.5,
                    }}
                  >
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveStatus(status.id, 'up')}
                        disabled={index === 0}
                        className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30"
                        title="Move up"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveStatus(status.id, 'down')}
                        disabled={index === jobStatuses.length - 1}
                        className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30"
                        title="Move down"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Key */}
                    <code className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                      {status.key}
                    </code>

                    {/* Label - editable */}
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
                              border: '1px solid var(--border-subtle)',
                            }}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') updateJobStatus(status.id, { label: editingLabel });
                              if (e.key === 'Escape') setEditingStatusId(null);
                            }}
                          />
                          <button
                            onClick={() => updateJobStatus(status.id, { label: editingLabel })}
                            className="btn btn-primary btn-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingStatusId(null)}
                            className="btn btn-secondary btn-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span
                          className="cursor-pointer hover:underline"
                          style={{ color: 'var(--christmas-cream)' }}
                          onClick={() => {
                            setEditingStatusId(status.id);
                            setEditingLabel(status.label);
                          }}
                          title="Click to edit"
                        >
                          {status.label}
                        </span>
                      )}
                    </div>

                    {/* Active toggle */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={status.is_active}
                        onChange={(e) => updateJobStatus(status.id, { is_active: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                  </div>
                ))}
              </div>

              {/* Add New Status */}
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="font-medium mb-3" style={{ color: 'var(--christmas-cream)' }}>
                  Add New Status
                </div>
                <div className="flex gap-3 flex-wrap">
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Label</label>
                    <input
                      type="text"
                      placeholder="e.g., Payment Received"
                      value={newStatusLabel}
                      onChange={(e) => setNewStatusLabel(e.target.value)}
                      className="w-full px-3 py-2 rounded"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--christmas-cream)',
                        border: '1px solid var(--border-subtle)',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newStatusLabel.trim()) addJobStatus();
                      }}
                    />
                  </div>
                  <div className="w-40">
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Key (optional)</label>
                    <input
                      type="text"
                      placeholder="auto-generated"
                      value={newStatusKey}
                      onChange={(e) => setNewStatusKey(e.target.value)}
                      className="w-full px-3 py-2 rounded"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--christmas-cream)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={addJobStatus}
                      disabled={addingStatus || !newStatusLabel.trim()}
                      className="btn btn-primary"
                    >
                      {addingStatus ? 'Adding...' : 'Add Status'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
