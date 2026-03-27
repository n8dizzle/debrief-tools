'use client';

import { useState, useEffect } from 'react';
import { useServiceDashboardPermissions } from '@/hooks/usePermissions';
import type { InfractionTypeConfig, AttendanceThreshold } from '@/lib/supabase';

type SettingsTab = 'sync' | 'scoring' | 'attendance';

const WEIGHT_LABELS: Record<string, string> = {
  gross_sales: 'Sales',
  tgls: 'Leads Set',
  options_per_opportunity: 'Options/Opportunity',
  memberships_sold: 'Memberships Sold',
  reviews: 'Google Reviews',
  attendance: 'Attendance',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function SettingsPage() {
  const { canManageSettings, isOwner, isManager } = useServiceDashboardPermissions();
  const canEdit = isOwner || isManager;
  const [activeTab, setActiveTab] = useState<SettingsTab>('sync');

  // Sync state
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncLoading, setSyncLoading] = useState(true);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Weights state
  const [weights, setWeights] = useState<Record<string, number>>({
    gross_sales: 0.25,
    tgls: 0.15,
    options_per_opportunity: 0.15,
    memberships_sold: 0.15,
    reviews: 0.15,
    attendance: 0.15,
  });
  const [saving, setSaving] = useState(false);
  const [weightsMessage, setWeightsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Attendance config state
  const [infractionTypes, setInfractionTypes] = useState<InfractionTypeConfig[]>([]);
  const [thresholds, setThresholds] = useState<AttendanceThreshold[]>([]);
  const [rollingMonths, setRollingMonths] = useState(12);
  const [attSaving, setAttSaving] = useState(false);
  const [attMessage, setAttMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSyncLogs = () => {
    fetch('/api/settings/sync')
      .then(res => res.json())
      .then(data => {
        if (data.logs) setSyncLogs(data.logs);
      })
      .catch(console.error)
      .finally(() => setSyncLoading(false));
  };

  useEffect(() => {
    fetchSyncLogs();
    fetch('/api/settings/weights')
      .then(res => res.json())
      .then(data => {
        if (data.weights) setWeights(data.weights);
      })
      .catch(console.error);
    fetch('/api/settings/attendance')
      .then(res => res.json())
      .then(data => {
        if (data.infraction_types) setInfractionTypes(data.infraction_types);
        if (data.thresholds) setThresholds(data.thresholds);
        if (data.rolling_months) setRollingMonths(data.rolling_months);
      })
      .catch(console.error);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/settings/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage({
          type: 'success',
          text: `Sync complete: ${data.technicians_synced} techs, ${data.jobs_synced} jobs, ${data.leads_synced} leads, ${data.memberships_synced} memberships.`,
        });
        fetchSyncLogs();
      } else {
        setSyncMessage({ type: 'error', text: data.error || 'Sync failed.' });
      }
    } catch {
      setSyncMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleWeightChange = (key: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= 1) {
      setWeights(prev => ({ ...prev, [key]: num }));
    }
  };

  const totalWeight = Object.values(weights).reduce((s, v) => s + v, 0);
  const isValid = Math.abs(totalWeight - 1.0) < 0.01;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    setWeightsMessage(null);
    try {
      const res = await fetch('/api/settings/weights', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights }),
      });
      if (res.ok) {
        setWeightsMessage({ type: 'success', text: 'Weights saved successfully.' });
      } else {
        const data = await res.json();
        setWeightsMessage({ type: 'error', text: data.error || 'Failed to save.' });
      }
    } catch {
      setWeightsMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setSaving(false);
      setTimeout(() => setWeightsMessage(null), 3000);
    }
  };

  // Attendance config handlers
  const updateInfractionType = (index: number, field: keyof InfractionTypeConfig, value: string | number) => {
    setInfractionTypes(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Auto-generate key from label if editing label
      if (field === 'label' && typeof value === 'string') {
        updated[index].key = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      }
      return updated;
    });
  };

  const addInfractionType = () => {
    setInfractionTypes(prev => [...prev, { key: '', label: '', points: 1 }]);
  };

  const removeInfractionType = (index: number) => {
    setInfractionTypes(prev => prev.filter((_, i) => i !== index));
  };

  const updateThreshold = (index: number, field: keyof AttendanceThreshold, value: string | number) => {
    setThresholds(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addThreshold = () => {
    const maxPoints = thresholds.length > 0 ? Math.max(...thresholds.map(t => t.points)) : 0;
    setThresholds(prev => [...prev, { points: maxPoints + 3, label: '' }]);
  };

  const removeThreshold = (index: number) => {
    setThresholds(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveAttendance = async () => {
    // Validate
    const hasEmptyLabels = infractionTypes.some(t => !t.label.trim());
    const hasEmptyThresholdLabels = thresholds.some(t => !t.label.trim());
    if (hasEmptyLabels || hasEmptyThresholdLabels) {
      setAttMessage({ type: 'error', text: 'All labels are required.' });
      return;
    }

    setAttSaving(true);
    setAttMessage(null);
    try {
      const res = await fetch('/api/settings/attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          infraction_types: infractionTypes,
          thresholds,
          rolling_months: rollingMonths,
        }),
      });
      if (res.ok) {
        setAttMessage({ type: 'success', text: 'Attendance settings saved.' });
      } else {
        const data = await res.json();
        setAttMessage({ type: 'error', text: data.error || 'Failed to save.' });
      }
    } catch {
      setAttMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setAttSaving(false);
      setTimeout(() => setAttMessage(null), 3000);
    }
  };

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'sync', label: 'Data Sync' },
    { id: 'scoring', label: 'Scoring' },
    { id: 'attendance', label: 'Attendance' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Settings
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Sync configuration, scoring weights, and attendance rules
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        {tabs.map(tab => (
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

      {/* Data Sync Tab */}
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
                    Daily at 6am CT + Every 2 hours 8am&ndash;4pm Mon&ndash;Fri
                  </div>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: 'var(--status-success)' }}
                >
                  Enabled
                </span>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div>
                  <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                    Manual Sync
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Sync technicians, jobs, estimates, leads, and memberships from ServiceTitan
                  </div>
                </div>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="btn btn-primary flex-shrink-0"
                  style={{ opacity: syncing ? 0.5 : 1 }}
                >
                  {syncing ? 'Syncing...' : 'Run Sync'}
                </button>
              </div>
            </div>

            {syncMessage && (
              <div
                className="mt-4 p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: syncMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: syncMessage.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
                }}
              >
                {syncMessage.text}
              </div>
            )}
          </div>

          {/* Sync History */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              Sync History
            </h2>
            {syncLoading ? (
              <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>Loading...</div>
            ) : syncLogs.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                No sync history yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <th className="text-left py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Started</th>
                      <th className="text-left py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Duration</th>
                      <th className="text-left py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                      <th className="text-right py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Techs</th>
                      <th className="text-right py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Jobs</th>
                      <th className="text-right py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Leads</th>
                      <th className="text-right py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Memberships</th>
                      <th className="text-left py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncLogs.map((log: any) => {
                      const duration = log.completed_at
                        ? Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                        : null;
                      const durationStr = duration !== null
                        ? duration >= 60
                          ? `${Math.floor(duration / 60)}m ${duration % 60}s`
                          : `${duration}s`
                        : '—';
                      const hasErrors = log.errors && (Array.isArray(log.errors) ? log.errors.length > 0 : true);
                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="py-2.5 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                            {formatDateTime(log.started_at)}
                          </td>
                          <td className="py-2.5" style={{ color: 'var(--text-muted)' }}>
                            {durationStr}
                          </td>
                          <td className="py-2.5">
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: log.status === 'success'
                                  ? 'rgba(34, 197, 94, 0.15)'
                                  : log.status === 'running'
                                    ? 'rgba(234, 179, 8, 0.15)'
                                    : 'rgba(239, 68, 68, 0.15)',
                                color: log.status === 'success'
                                  ? 'var(--status-success)'
                                  : log.status === 'running'
                                    ? 'var(--christmas-gold)'
                                    : 'var(--status-error)',
                              }}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-right" style={{ color: 'var(--text-secondary)' }}>
                            {log.technicians_synced}
                          </td>
                          <td className="py-2.5 text-right" style={{ color: 'var(--text-secondary)' }}>
                            {log.jobs_synced}
                          </td>
                          <td className="py-2.5 text-right" style={{ color: 'var(--text-secondary)' }}>
                            {log.leads_synced}
                          </td>
                          <td className="py-2.5 text-right" style={{ color: 'var(--text-secondary)' }}>
                            {log.memberships_synced || 0}
                          </td>
                          <td
                            className="py-2.5 max-w-[200px] truncate"
                            style={{ color: hasErrors ? 'var(--status-error)' : 'var(--text-muted)' }}
                            title={hasErrors ? (Array.isArray(log.errors) ? log.errors.join('; ') : String(log.errors)) : ''}
                          >
                            {hasErrors
                              ? (Array.isArray(log.errors) ? `${log.errors.length} error${log.errors.length !== 1 ? 's' : ''}` : 'Error')
                              : '—'}
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

      {/* Scoring Tab */}
      {activeTab === 'scoring' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              Scoring Weights
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Adjust how much each KPI contributes to the overall score. Weights must sum to 100%.
            </p>

            {weightsMessage && (
              <div
                className="mb-4 p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: weightsMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: weightsMessage.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
                }}
              >
                {weightsMessage.text}
              </div>
            )}

            <div className="space-y-3">
              {Object.entries(WEIGHT_LABELS).map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="5"
                      value={Math.round((weights[key] || 0) * 100)}
                      onChange={(e) => handleWeightChange(key, (parseFloat(e.target.value) / 100).toString())}
                      disabled={!canEdit}
                      className="input w-20 text-right"
                    />
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>%</span>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="flex items-center justify-between mt-4 pt-4 border-t"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Total
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: isValid ? 'var(--status-success)' : 'var(--status-error)' }}
              >
                {Math.round(totalWeight * 100)}%
              </span>
            </div>

            {canEdit && (
              <button
                onClick={handleSave}
                disabled={!isValid || saving}
                className="btn btn-primary mt-6 w-full"
                style={{ opacity: (!isValid || saving) ? 0.5 : 1 }}
              >
                {saving ? 'Saving...' : 'Save Weights'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {attMessage && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{
                backgroundColor: attMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: attMessage.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
              }}
            >
              {attMessage.text}
            </div>
          )}

          {/* Infraction Types */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                  Infraction Types
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Define the types of attendance infractions and their point values.
                </p>
              </div>
              {canEdit && (
                <button onClick={addInfractionType} className="btn btn-secondary text-sm flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Type
                </button>
              )}
            </div>

            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-[1fr_80px_40px] gap-3 px-3 pb-1">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Label</span>
                <span className="text-xs font-medium text-right" style={{ color: 'var(--text-muted)' }}>Points</span>
                <span></span>
              </div>

              {infractionTypes.map((infraction, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_80px_40px] gap-3 items-center p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <input
                    type="text"
                    value={infraction.label}
                    onChange={(e) => updateInfractionType(index, 'label', e.target.value)}
                    disabled={!canEdit}
                    className="input text-sm"
                    placeholder="e.g., No Call / No Show"
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={infraction.points}
                    onChange={(e) => updateInfractionType(index, 'points', parseFloat(e.target.value) || 0)}
                    disabled={!canEdit}
                    className="input text-sm text-right"
                  />
                  {canEdit && (
                    <button
                      onClick={() => removeInfractionType(index)}
                      className="p-1.5 rounded hover:bg-[var(--bg-card-hover)] transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Disciplinary Thresholds */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                  Disciplinary Thresholds
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Define the point levels that trigger disciplinary actions.
                </p>
              </div>
              {canEdit && (
                <button onClick={addThreshold} className="btn btn-secondary text-sm flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Level
                </button>
              )}
            </div>

            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-[80px_1fr_40px] gap-3 px-3 pb-1">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Points</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Action</span>
                <span></span>
              </div>

              {thresholds.map((threshold, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[80px_1fr_40px] gap-3 items-center p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={threshold.points}
                    onChange={(e) => updateThreshold(index, 'points', parseInt(e.target.value) || 0)}
                    disabled={!canEdit}
                    className="input text-sm text-right"
                  />
                  <input
                    type="text"
                    value={threshold.label}
                    onChange={(e) => updateThreshold(index, 'label', e.target.value)}
                    disabled={!canEdit}
                    className="input text-sm"
                    placeholder="e.g., Written Warning"
                  />
                  {canEdit && (
                    <button
                      onClick={() => removeThreshold(index)}
                      className="p-1.5 rounded hover:bg-[var(--bg-card-hover)] transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rolling Window */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              Rolling Window
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              How many months of history to include when calculating point totals.
            </p>
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
            >
              <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Rolling Period
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="36"
                  value={rollingMonths}
                  onChange={(e) => setRollingMonths(parseInt(e.target.value) || 12)}
                  disabled={!canEdit}
                  className="input w-20 text-right"
                />
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>months</span>
              </div>
            </div>
          </div>

          {/* Sticky Save Button */}
          {canEdit && (
            <div
              className="sticky bottom-0 pt-4 pb-2 -mx-1 px-1"
              style={{ background: 'linear-gradient(to top, var(--bg-primary) 60%, transparent)' }}
            >
              <button
                onClick={handleSaveAttendance}
                disabled={attSaving}
                className="btn btn-primary w-full"
                style={{ opacity: attSaving ? 0.5 : 1 }}
              >
                {attSaving ? 'Saving...' : 'Save Attendance Settings'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
