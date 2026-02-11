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

function detectTrade(buName: string): 'hvac' | 'plumbing' {
  return buName.toLowerCase().includes('plumb') ? 'plumbing' : 'hvac';
}

export default function SettingsPage() {
  const { isManager, isOwner, canSyncData } = useAPPermissions();

  // BU → Trade mapping state
  const [buNames, setBuNames] = useState<string[]>([]);
  const [tradeMapping, setTradeMapping] = useState<Record<string, string>>({});
  const [savedTradeMapping, setSavedTradeMapping] = useState<Record<string, string>>({});
  const [loadingMapping, setLoadingMapping] = useState(true);
  const [savingMapping, setSavingMapping] = useState(false);
  const [mappingSaveMessage, setMappingSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync history state
  const [syncHistory, setSyncHistory] = useState<SyncLogEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Manual sync
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSettings = useCallback(async () => {
    setLoadingMapping(true);
    try {
      const [buRes, settingsRes] = await Promise.all([
        fetch('/api/jobs/business-units'),
        fetch('/api/settings/sync'),
      ]);

      if (buRes.ok) {
        setBuNames(await buRes.json());
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setTradeMapping(data.bu_trade_mapping || {});
        setSavedTradeMapping(data.bu_trade_mapping || {});
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoadingMapping(false);
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
    loadSettings();
    loadSyncHistory();
  }, [loadSettings, loadSyncHistory]);

  const hasMappingChanges = JSON.stringify(tradeMapping) !== JSON.stringify(savedTradeMapping);

  const handleSaveMapping = async () => {
    setSavingMapping(true);
    setMappingSaveMessage(null);
    try {
      const res = await fetch('/api/settings/sync', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bu_trade_mapping: tradeMapping }),
      });
      if (res.ok) {
        setSavedTradeMapping({ ...tradeMapping });
        setMappingSaveMessage({ type: 'success', text: 'Trade mapping saved successfully' });
        setTimeout(() => setMappingSaveMessage(null), 4000);
      } else {
        setMappingSaveMessage({ type: 'error', text: 'Failed to save mapping' });
      }
    } catch {
      setMappingSaveMessage({ type: 'error', text: 'Failed to save mapping' });
    } finally {
      setSavingMapping(false);
    }
  };

  const handleTradeChange = (bu: string, trade: string) => {
    setTradeMapping(prev => ({ ...prev, [bu]: trade }));
  };

  const getTradeForBU = (bu: string): string => {
    return tradeMapping[bu] || detectTrade(bu);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        await Promise.all([loadSyncHistory(), loadSettings()]);
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    setBackfillResult(null);

    let chunk = 0;
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;

    try {
      while (true) {
        setBackfillResult({
          type: 'success',
          text: `Processing chunk ${chunk + 1}... (${totalCreated} created, ${totalUpdated} updated so far)`,
        });

        const res = await fetch(`/api/backfill?chunk=${chunk}`, { method: 'POST' });
        const data = await res.json();

        if (!res.ok) {
          setBackfillResult({ type: 'error', text: data.error || `Backfill failed on chunk ${chunk + 1}` });
          break;
        }

        totalProcessed += data.jobs_processed || 0;
        totalCreated += data.jobs_created || 0;
        totalUpdated += data.jobs_updated || 0;

        if (data.done) {
          setBackfillResult({
            type: 'success',
            text: `Backfill complete: ${totalProcessed} jobs processed, ${totalCreated} created, ${totalUpdated} updated across ${data.chunks_total} chunks`,
          });
          await Promise.all([loadSyncHistory(), loadSettings()]);
          break;
        }

        chunk++;
      }
    } catch (err) {
      setBackfillResult({ type: 'error', text: 'Backfill request failed' });
    } finally {
      setBackfilling(false);
    }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichResult(null);
    let totalEnriched = 0;

    try {
      while (true) {
        setEnrichResult({
          type: 'success',
          text: `Enriching customer data... (${totalEnriched} updated so far)`,
        });

        const res = await fetch('/api/backfill/enrich', { method: 'POST' });
        const data = await res.json();

        if (!res.ok) {
          setEnrichResult({ type: 'error', text: data.error || 'Enrichment failed' });
          break;
        }

        totalEnriched += data.enriched || 0;

        if (data.done) {
          setEnrichResult({
            type: 'success',
            text: totalEnriched > 0
              ? `Done! Updated customer info for ${totalEnriched} jobs.`
              : 'All jobs already have customer data.',
          });
          break;
        }
      }
    } catch {
      setEnrichResult({ type: 'error', text: 'Enrichment request failed' });
    } finally {
      setEnriching(false);
    }
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return '—';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (!isManager && !isOwner) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: 'var(--text-muted)' }}>You don&apos;t have permission to access settings.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Settings
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Sync configuration and business unit mapping
        </p>
      </div>

      <div className="space-y-6">

        {/* Manual Sync Row */}
        <div className="card">
          <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div>
              <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                Manual Sync
              </div>
              <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Pull latest jobs from ServiceTitan now (all business units)
              </div>
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
                ) : 'Sync Now'}
              </button>
            )}
          </div>

          {/* Schedule Info */}
          <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="font-medium mb-2" style={{ color: 'var(--christmas-cream)' }}>
              Auto Sync Schedule
            </div>
            <div className="text-sm space-y-1" style={{ color: 'var(--text-muted)' }}>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--christmas-green-light)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Every 2 hours during business hours (8am–6pm CT, Mon–Fri)</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--christmas-green-light)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Daily full sync at 6am CT</span>
              </div>
            </div>
          </div>
        </div>

        {/* Historical Backfill */}
        <div className="card">
          <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div>
              <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                Historical Backfill
              </div>
              <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Pull all jobs since Jan 1, 2026. This may take up to 60 seconds.
              </div>
            </div>
            {canSyncData && (
              <button
                onClick={handleBackfill}
                disabled={backfilling}
                className="btn btn-secondary"
                style={{ opacity: backfilling ? 0.6 : 1, whiteSpace: 'nowrap' }}
              >
                {backfilling ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Backfilling...
                  </>
                ) : 'Run Backfill'}
              </button>
            )}
          </div>
          {backfillResult && (
            <div
              className="mt-3 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: backfillResult.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: backfillResult.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
              }}
            >
              {backfillResult.text}
            </div>
          )}
        </div>

        {/* Fix Missing Customers */}
        <div className="card">
          <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div>
              <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                Fix Missing Customers
              </div>
              <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Fetch customer names and addresses for jobs that are missing them.
              </div>
            </div>
            {canSyncData && (
              <button
                onClick={handleEnrich}
                disabled={enriching}
                className="btn btn-secondary"
                style={{ opacity: enriching ? 0.6 : 1, whiteSpace: 'nowrap' }}
              >
                {enriching ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Enriching...
                  </>
                ) : 'Fix Customers'}
              </button>
            )}
          </div>
          {enrichResult && (
            <div
              className="mt-3 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: enrichResult.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: enrichResult.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
              }}
            >
              {enrichResult.text}
            </div>
          )}
        </div>

        {/* BU → Trade Mapping */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>
            Business Unit → Trade Mapping
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Map each business unit to a trade. This determines how jobs are categorized for contractor rate matching and reporting.
          </p>

          {mappingSaveMessage && (
            <div
              className="mb-4 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: mappingSaveMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: mappingSaveMessage.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
              }}
            >
              {mappingSaveMessage.text}
            </div>
          )}

          {loadingMapping ? (
            <div className="flex items-center gap-2 py-4" style={{ color: 'var(--text-muted)' }}>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          ) : buNames.length === 0 ? (
            <div className="p-4 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
              No business units found. Run a sync first to populate job data.
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {buNames.map(bu => {
                  const trade = getTradeForBU(bu);
                  return (
                    <div
                      key={bu}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <span className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {bu}
                      </span>
                      <select
                        className="text-sm py-1.5 px-3 rounded-md"
                        value={trade}
                        onChange={(e) => handleTradeChange(bu, e.target.value)}
                        style={{
                          backgroundColor: 'var(--bg-tertiary, var(--bg-primary))',
                          color: 'var(--christmas-cream)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <option value="hvac">HVAC</option>
                        <option value="plumbing">Plumbing</option>
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveMapping}
                  disabled={savingMapping || !hasMappingChanges}
                  className="btn btn-primary"
                  style={{ opacity: savingMapping || !hasMappingChanges ? 0.5 : 1 }}
                >
                  {savingMapping ? 'Saving...' : 'Save Mapping'}
                </button>
                {hasMappingChanges && (
                  <button
                    onClick={() => setTradeMapping({ ...savedTradeMapping })}
                    className="btn btn-secondary text-sm"
                  >
                    Discard
                  </button>
                )}
              </div>
            </>
          )}

          <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-xs space-y-2" style={{ color: 'var(--text-muted)' }}>
              <div className="flex gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--christmas-green-light)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>By default, business units with &quot;Plumb&quot; in the name are mapped to Plumbing. All others default to HVAC.</span>
              </div>
              <div className="flex gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--christmas-green-light)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Changes take effect on the next sync. Existing jobs are not retroactively updated.</span>
              </div>
            </div>
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
            <div className="p-6 rounded-lg text-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No sync history yet. Run a manual sync to get started.</p>
            </div>
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
    </div>
  );
}
