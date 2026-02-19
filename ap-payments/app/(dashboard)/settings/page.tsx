'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import { formatTimestamp, formatCurrency } from '@/lib/ap-utils';
import type { APTechnician } from '@/lib/supabase';

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

type SettingsTab = 'sync' | 'technicians' | 'trade-mapping' | 'notifications' | 'history';

export default function SettingsPage() {
  const { isManager, isOwner, canSyncData } = useAPPermissions();
  const [activeTab, setActiveTab] = useState<SettingsTab>('sync');

  // BU → Trade mapping state
  const [buNames, setBuNames] = useState<string[]>([]);
  const [tradeMapping, setTradeMapping] = useState<Record<string, string>>({});
  const [savedTradeMapping, setSavedTradeMapping] = useState<Record<string, string>>({});
  const [loadingMapping, setLoadingMapping] = useState(true);
  const [savingMapping, setSavingMapping] = useState(false);
  const [mappingSaveMessage, setMappingSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Allowed BUs state
  const [allowedBUs, setAllowedBUs] = useState<string[]>([]);
  const [savedAllowedBUs, setSavedAllowedBUs] = useState<string[]>([]);
  const [savingBUs, setSavingBUs] = useState(false);
  const [buSaveMessage, setBuSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Default hourly rates state
  const [defaultRates, setDefaultRates] = useState<Record<string, number>>({});
  const [savedDefaultRates, setSavedDefaultRates] = useState<Record<string, number>>({});
  const [savingRates, setSavingRates] = useState(false);
  const [ratesSaveMessage, setRatesSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync history state
  const [syncHistory, setSyncHistory] = useState<SyncLogEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Technician state
  const [technicians, setTechnicians] = useState<APTechnician[]>([]);
  const [loadingTechs, setLoadingTechs] = useState(true);
  const [syncingTechs, setSyncingTechs] = useState(false);
  const [techSyncResult, setTechSyncResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingTechId, setEditingTechId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState('');
  const [savingTech, setSavingTech] = useState(false);

  // Notification phones state
  const [notifPhones, setNotifPhones] = useState<{ name: string; phone: string }[]>([]);
  const [savedNotifPhones, setSavedNotifPhones] = useState<{ name: string; phone: string }[]>([]);
  const [loadingNotif, setLoadingNotif] = useState(true);
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifMessage, setNotifMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Notification emails state
  const [notifEmails, setNotifEmails] = useState<{ name: string; email: string }[]>([]);
  const [savedNotifEmails, setSavedNotifEmails] = useState<{ name: string; email: string }[]>([]);
  const [savingEmails, setSavingEmails] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Install manager notification state
  const [mgrPhones, setMgrPhones] = useState<{ name: string; phone: string }[]>([]);
  const [savedMgrPhones, setSavedMgrPhones] = useState<{ name: string; phone: string }[]>([]);
  const [savingMgr, setSavingMgr] = useState(false);
  const [mgrMessage, setMgrMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mgrEmails, setMgrEmails] = useState<{ name: string; email: string }[]>([]);
  const [savedMgrEmails, setSavedMgrEmails] = useState<{ name: string; email: string }[]>([]);
  const [savingMgrEmails, setSavingMgrEmails] = useState(false);
  const [mgrEmailMessage, setMgrEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Manual sync
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [enrichingInvoices, setEnrichingInvoices] = useState(false);
  const [enrichInvoiceResult, setEnrichInvoiceResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        setAllowedBUs(data.sync_business_units || []);
        setSavedAllowedBUs(data.sync_business_units || []);
        setDefaultRates(data.default_hourly_rates || {});
        setSavedDefaultRates(data.default_hourly_rates || {});
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

  const loadNotifPhones = useCallback(async () => {
    setLoadingNotif(true);
    try {
      const res = await fetch('/api/settings/notifications');
      if (res.ok) {
        const data = await res.json();
        const phones = data.notification_phones || [];
        setNotifPhones(phones);
        setSavedNotifPhones(phones);
        const emails = data.notification_emails || [];
        setNotifEmails(emails);
        setSavedNotifEmails(emails);
        const mgPhones = data.install_manager_phones || [];
        setMgrPhones(mgPhones);
        setSavedMgrPhones(mgPhones);
        const mgEmails = data.install_manager_emails || [];
        setMgrEmails(mgEmails);
        setSavedMgrEmails(mgEmails);
      }
    } catch (err) {
      console.error('Failed to load notification settings:', err);
    } finally {
      setLoadingNotif(false);
    }
  }, []);

  const loadTechnicians = useCallback(async () => {
    setLoadingTechs(true);
    try {
      const res = await fetch('/api/technicians');
      if (res.ok) {
        setTechnicians(await res.json());
      }
    } catch (err) {
      console.error('Failed to load technicians:', err);
    } finally {
      setLoadingTechs(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadSyncHistory();
    loadTechnicians();
    loadNotifPhones();
  }, [loadSettings, loadSyncHistory, loadTechnicians, loadNotifPhones]);

  const hasMappingChanges = JSON.stringify(tradeMapping) !== JSON.stringify(savedTradeMapping);
  const hasBUChanges = JSON.stringify([...allowedBUs].sort()) !== JSON.stringify([...savedAllowedBUs].sort());
  const hasRatesChanges = JSON.stringify(defaultRates) !== JSON.stringify(savedDefaultRates);

  const handleToggleBU = (bu: string) => {
    setAllowedBUs(prev =>
      prev.includes(bu) ? prev.filter(b => b !== bu) : [...prev, bu]
    );
  };

  const handleSaveAllowedBUs = async () => {
    setSavingBUs(true);
    setBuSaveMessage(null);
    try {
      const res = await fetch('/api/settings/sync', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_business_units: allowedBUs }),
      });
      if (res.ok) {
        setSavedAllowedBUs([...allowedBUs]);
        setBuSaveMessage({ type: 'success', text: 'Allowed business units saved' });
        setTimeout(() => setBuSaveMessage(null), 4000);
      } else {
        setBuSaveMessage({ type: 'error', text: 'Failed to save' });
      }
    } catch {
      setBuSaveMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSavingBUs(false);
    }
  };

  const handleSaveDefaultRates = async () => {
    setSavingRates(true);
    setRatesSaveMessage(null);
    try {
      const res = await fetch('/api/settings/sync', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_hourly_rates: defaultRates }),
      });
      if (res.ok) {
        setSavedDefaultRates({ ...defaultRates });
        setRatesSaveMessage({ type: 'success', text: 'Default rates saved' });
        setTimeout(() => setRatesSaveMessage(null), 4000);
      } else {
        setRatesSaveMessage({ type: 'error', text: 'Failed to save' });
      }
    } catch {
      setRatesSaveMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSavingRates(false);
    }
  };

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

  const handleSyncTechnicians = async () => {
    setSyncingTechs(true);
    setTechSyncResult(null);
    try {
      const res = await fetch('/api/technicians', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setTechSyncResult({ type: 'success', text: `Synced ${data.synced} technicians from ServiceTitan` });
        await loadTechnicians();
      } else {
        setTechSyncResult({ type: 'error', text: data.error || 'Sync failed' });
      }
    } catch {
      setTechSyncResult({ type: 'error', text: 'Request failed' });
    } finally {
      setSyncingTechs(false);
    }
  };

  const handleStartEditTech = (tech: APTechnician) => {
    setEditingTechId(tech.id);
    setEditRate(tech.hourly_rate != null ? String(tech.hourly_rate) : '');
  };

  const handleSaveTech = async (techId: string) => {
    setSavingTech(true);
    try {
      const res = await fetch(`/api/technicians/${techId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hourly_rate: editRate ? Number(editRate) : null,
        }),
      });
      if (res.ok) {
        setEditingTechId(null);
        await loadTechnicians();
      }
    } catch (err) {
      console.error('Failed to save technician:', err);
    } finally {
      setSavingTech(false);
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

  const handleEnrichInvoices = async () => {
    setEnrichingInvoices(true);
    setEnrichInvoiceResult(null);
    let totalEnriched = 0;

    try {
      while (true) {
        setEnrichInvoiceResult({
          type: 'success',
          text: `Enriching invoice data... (${totalEnriched} updated so far)`,
        });

        const res = await fetch('/api/backfill/enrich-invoices', { method: 'POST' });
        const data = await res.json();

        if (!res.ok) {
          setEnrichInvoiceResult({ type: 'error', text: data.error || 'Invoice enrichment failed' });
          break;
        }

        totalEnriched += data.enriched || 0;

        if (data.done) {
          setEnrichInvoiceResult({
            type: 'success',
            text: totalEnriched > 0
              ? `Done! Updated invoice info for ${totalEnriched} jobs.`
              : 'All jobs already have invoice data.',
          });
          break;
        }
      }
    } catch {
      setEnrichInvoiceResult({ type: 'error', text: 'Invoice enrichment request failed' });
    } finally {
      setEnrichingInvoices(false);
    }
  };

  const handleSaveNotifPhones = async () => {
    setSavingNotif(true);
    setNotifMessage(null);
    try {
      const validPhones = notifPhones.filter(p => p.name.trim() && p.phone.trim());
      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_phones: validPhones }),
      });
      if (res.ok) {
        setNotifPhones(validPhones);
        setSavedNotifPhones([...validPhones]);
        setNotifMessage({ type: 'success', text: 'Notification phones saved' });
        setTimeout(() => setNotifMessage(null), 4000);
      } else {
        setNotifMessage({ type: 'error', text: 'Failed to save' });
      }
    } catch {
      setNotifMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSavingNotif(false);
    }
  };

  const handleAddPhone = () => {
    setNotifPhones(prev => [...prev, { name: '', phone: '' }]);
  };

  const handleRemovePhone = (idx: number) => {
    setNotifPhones(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePhoneChange = (idx: number, field: 'name' | 'phone', value: string) => {
    setNotifPhones(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const hasNotifChanges = JSON.stringify(notifPhones) !== JSON.stringify(savedNotifPhones);
  const hasEmailChanges = JSON.stringify(notifEmails) !== JSON.stringify(savedNotifEmails);

  const handleSaveNotifEmails = async () => {
    setSavingEmails(true);
    setEmailMessage(null);
    try {
      const validEmails = notifEmails.filter(e => e.name.trim() && e.email.trim());
      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_emails: validEmails }),
      });
      if (res.ok) {
        setNotifEmails(validEmails);
        setSavedNotifEmails([...validEmails]);
        setEmailMessage({ type: 'success', text: 'Notification emails saved' });
        setTimeout(() => setEmailMessage(null), 4000);
      } else {
        setEmailMessage({ type: 'error', text: 'Failed to save' });
      }
    } catch {
      setEmailMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSavingEmails(false);
    }
  };

  const handleAddEmail = () => {
    setNotifEmails(prev => [...prev, { name: '', email: '' }]);
  };

  const handleRemoveEmail = (idx: number) => {
    setNotifEmails(prev => prev.filter((_, i) => i !== idx));
  };

  const handleEmailChange = (idx: number, field: 'name' | 'email', value: string) => {
    setNotifEmails(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
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

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'sync', label: 'Data Sync' },
    { id: 'technicians', label: 'Technicians' },
    { id: 'trade-mapping', label: 'Trade Mapping' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'history', label: 'Sync History' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Settings
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Sync configuration, technician rates, and business unit mapping
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
          {/* Manual Sync Row */}
          <div className="card">
            <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div>
                <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                  Manual Sync
                </div>
                <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Pull latest jobs from ServiceTitan now (filtered by allowed BUs)
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

          {/* Fix Missing Invoices */}
          <div className="card">
            <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div>
                <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                  Fix Missing Invoices
                </div>
                <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Fetch invoice numbers and export status for jobs that are missing them.
                </div>
              </div>
              {canSyncData && (
                <button
                  onClick={handleEnrichInvoices}
                  disabled={enrichingInvoices}
                  className="btn btn-secondary"
                  style={{ opacity: enrichingInvoices ? 0.6 : 1, whiteSpace: 'nowrap' }}
                >
                  {enrichingInvoices ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Enriching...
                    </>
                  ) : 'Fix Invoices'}
                </button>
              )}
            </div>
            {enrichInvoiceResult && (
              <div
                className="mt-3 p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: enrichInvoiceResult.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: enrichInvoiceResult.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
                }}
              >
                {enrichInvoiceResult.text}
              </div>
            )}
          </div>

          {/* Allowed Business Units */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>
              Sync Filter: Business Units
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              Only jobs from checked business units will be synced. Unchecked BUs are ignored during sync and backfill.
            </p>

            {buSaveMessage && (
              <div
                className="mb-4 p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: buSaveMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: buSaveMessage.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
                }}
              >
                {buSaveMessage.text}
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
                No business units found. Run a sync first.
              </div>
            ) : (
              <>
                <div className="space-y-1 mb-4">
                  {buNames.map(bu => (
                    <label
                      key={bu}
                      className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:opacity-90"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <input
                        type="checkbox"
                        checked={allowedBUs.includes(bu)}
                        onChange={() => handleToggleBU(bu)}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: 'var(--christmas-green)' }}
                      />
                      <span className="text-sm" style={{ color: 'var(--christmas-cream)' }}>{bu}</span>
                    </label>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveAllowedBUs}
                    disabled={savingBUs || !hasBUChanges}
                    className="btn btn-primary"
                    style={{ opacity: savingBUs || !hasBUChanges ? 0.5 : 1 }}
                  >
                    {savingBUs ? 'Saving...' : 'Save'}
                  </button>
                  {hasBUChanges && (
                    <button
                      onClick={() => setAllowedBUs([...savedAllowedBUs])}
                      className="btn btn-secondary text-sm"
                    >
                      Discard
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Default Hourly Rates */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>
              Default Hourly Rates
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              Fallback rates used when a technician doesn&apos;t have a specific hourly rate set. Applied per-trade for labor cost calculations.
            </p>

            {ratesSaveMessage && (
              <div
                className="mb-4 p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: ratesSaveMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: ratesSaveMessage.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
                }}
              >
                {ratesSaveMessage.text}
              </div>
            )}

            <div className="space-y-3 mb-4">
              {(['hvac', 'plumbing'] as const).map(trade => (
                <div
                  key={trade}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <span className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
                    {trade === 'hvac' ? 'HVAC' : 'Plumbing'} Default Rate
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>$</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="0.00"
                      value={defaultRates[trade] || ''}
                      onChange={e => setDefaultRates(prev => ({
                        ...prev,
                        [trade]: e.target.value ? Number(e.target.value) : 0,
                      }))}
                      className="w-24 text-sm py-1.5 px-2 rounded-md text-right"
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--christmas-cream)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    />
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/hr</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveDefaultRates}
                disabled={savingRates || !hasRatesChanges}
                className="btn btn-primary"
                style={{ opacity: savingRates || !hasRatesChanges ? 0.5 : 1 }}
              >
                {savingRates ? 'Saving...' : 'Save Rates'}
              </button>
              {hasRatesChanges && (
                <button
                  onClick={() => setDefaultRates({ ...savedDefaultRates })}
                  className="btn btn-secondary text-sm"
                >
                  Discard
                </button>
              )}
            </div>

            <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                <div className="flex gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--christmas-green-light)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>These rates are used only when a technician has no individual rate set. Individual technician rates (Technicians tab) always take priority.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Technicians Tab */}
      {activeTab === 'technicians' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                Technician Rates
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Set burdened hourly rates for in-house labor cost calculations
              </p>
            </div>
            {canSyncData && (
              <button
                onClick={handleSyncTechnicians}
                disabled={syncingTechs}
                className="btn btn-secondary text-sm"
                style={{ opacity: syncingTechs ? 0.6 : 1, whiteSpace: 'nowrap' }}
              >
                {syncingTechs ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Syncing...
                  </>
                ) : 'Sync Technicians'}
              </button>
            )}
          </div>

          {techSyncResult && (
            <div
              className="mb-4 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: techSyncResult.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: techSyncResult.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
              }}
            >
              {techSyncResult.text}
            </div>
          )}

          {loadingTechs ? (
            <div className="flex items-center gap-2 py-4" style={{ color: 'var(--text-muted)' }}>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          ) : technicians.length === 0 ? (
            <div className="p-4 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
              No technicians found. Click &quot;Sync Technicians&quot; to pull from ServiceTitan.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Business Unit</th>
                    <th>Hourly Rate</th>
                    <th>Active</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {technicians.map(tech => (
                    <tr key={tech.id}>
                      <td className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {tech.name}
                      </td>
                      <td className="text-sm" style={{ color: tech.business_unit_name ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {tech.business_unit_name || '—'}
                      </td>
                      <td>
                        {editingTechId === tech.id ? (
                          <input
                            type="number"
                            step="0.5"
                            placeholder="0.00"
                            value={editRate}
                            onChange={e => setEditRate(e.target.value)}
                            className="w-24 text-sm py-1 px-2 rounded"
                            style={{
                              backgroundColor: 'var(--bg-primary)',
                              color: 'var(--christmas-cream)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          />
                        ) : (
                          <span className="text-sm" style={{ color: tech.hourly_rate ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {tech.hourly_rate ? formatCurrency(tech.hourly_rate) : '—'}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: tech.is_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                            color: tech.is_active ? 'var(--status-success)' : 'var(--text-muted)',
                          }}
                        >
                          {tech.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        {editingTechId === tech.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleSaveTech(tech.id)}
                              disabled={savingTech}
                              className="text-xs px-2 py-1 rounded"
                              style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
                            >
                              {savingTech ? '...' : 'Save'}
                            </button>
                            <button
                              onClick={() => setEditingTechId(null)}
                              className="text-xs px-2 py-1 rounded"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEditTech(tech)}
                            className="text-xs"
                            style={{ color: 'var(--christmas-green-light)' }}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Trade Mapping Tab */}
      {activeTab === 'trade-mapping' && (
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
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>
            SMS Notifications
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Team members who receive SMS notifications when jobs are assigned or payment statuses change.
          </p>

          {notifMessage && (
            <div
              className="mb-4 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: notifMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: notifMessage.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
              }}
            >
              {notifMessage.text}
            </div>
          )}

          {loadingNotif ? (
            <div className="flex items-center gap-2 py-4" style={{ color: 'var(--text-muted)' }}>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {notifPhones.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <input
                      type="text"
                      placeholder="Name"
                      value={entry.name}
                      onChange={e => handlePhoneChange(idx, 'name', e.target.value)}
                      className="flex-1 text-sm py-1.5 px-3 rounded-md"
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--christmas-cream)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    />
                    <input
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={entry.phone}
                      onChange={e => handlePhoneChange(idx, 'phone', e.target.value)}
                      className="flex-1 text-sm py-1.5 px-3 rounded-md"
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--christmas-cream)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    />
                    <button
                      onClick={() => handleRemovePhone(idx)}
                      className="p-1.5 rounded hover:opacity-80"
                      style={{ color: 'var(--status-error)' }}
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                {notifPhones.length === 0 && (
                  <div className="p-4 rounded-lg text-sm text-center" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                    No notification recipients configured. Add team members below.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddPhone}
                  className="btn btn-secondary text-sm"
                >
                  + Add Phone
                </button>
                {hasNotifChanges && (
                  <>
                    <button
                      onClick={handleSaveNotifPhones}
                      disabled={savingNotif}
                      className="btn btn-primary"
                      style={{ opacity: savingNotif ? 0.5 : 1 }}
                    >
                      {savingNotif ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setNotifPhones([...savedNotifPhones])}
                      className="btn btn-secondary text-sm"
                    >
                      Discard
                    </button>
                  </>
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
                <span>These team members will receive SMS when a job is assigned to a contractor or a payment status changes.</span>
              </div>
              <div className="flex gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--christmas-green-light)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Contractors with a phone number on file will also receive notifications automatically.</span>
              </div>
            </div>
          </div>

          {/* Email Notifications */}
          <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>
              Email Notifications
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              Team members who also receive email notifications for assignment and payment events.
            </p>

            {emailMessage && (
              <div
                className="mb-4 p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: emailMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: emailMessage.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
                }}
              >
                {emailMessage.text}
              </div>
            )}

            <div className="space-y-2 mb-4">
              {notifEmails.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <input
                    type="text"
                    placeholder="Name"
                    value={entry.name}
                    onChange={e => handleEmailChange(idx, 'name', e.target.value)}
                    className="flex-1 text-sm py-1.5 px-3 rounded-md"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--christmas-cream)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  />
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={entry.email}
                    onChange={e => handleEmailChange(idx, 'email', e.target.value)}
                    className="flex-1 text-sm py-1.5 px-3 rounded-md"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--christmas-cream)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  />
                  <button
                    onClick={() => handleRemoveEmail(idx)}
                    className="p-1.5 rounded hover:opacity-80"
                    style={{ color: 'var(--status-error)' }}
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              {notifEmails.length === 0 && (
                <div className="p-4 rounded-lg text-sm text-center" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                  No email recipients configured. Add team members below.
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleAddEmail}
                className="btn btn-secondary text-sm"
              >
                + Add Email
              </button>
              {hasEmailChanges && (
                <>
                  <button
                    onClick={handleSaveNotifEmails}
                    disabled={savingEmails}
                    className="btn btn-primary"
                    style={{ opacity: savingEmails ? 0.5 : 1 }}
                  >
                    {savingEmails ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setNotifEmails([...savedNotifEmails])}
                    className="btn btn-secondary text-sm"
                  >
                    Discard
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Install Manager Notifications */}
          <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border-default)' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--christmas-cream)' }}>
              Install Manager Notifications
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Install managers receive approval requests when invoices arrive via AP email. They do NOT receive routine payment notifications.
            </p>

            {mgrMessage && (
              <div className="mb-3 p-2.5 rounded-lg text-sm" style={{
                backgroundColor: mgrMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: mgrMessage.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
              }}>
                {mgrMessage.text}
              </div>
            )}

            {/* Manager Phones */}
            <div className="mb-4">
              <label className="text-xs font-medium uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
                Phone Numbers
              </label>
              <div className="space-y-2 mb-3">
                {mgrPhones.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      className="input text-sm flex-1"
                      placeholder="Name"
                      value={entry.name}
                      onChange={(e) => {
                        const next = [...mgrPhones];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setMgrPhones(next);
                      }}
                    />
                    <input
                      type="tel"
                      className="input text-sm flex-1"
                      placeholder="(555) 123-4567"
                      value={entry.phone}
                      onChange={(e) => {
                        const next = [...mgrPhones];
                        next[idx] = { ...next[idx], phone: e.target.value };
                        setMgrPhones(next);
                      }}
                    />
                    <button
                      onClick={() => setMgrPhones(mgrPhones.filter((_, i) => i !== idx))}
                      className="p-1.5 rounded hover:opacity-80"
                      style={{ color: 'var(--status-error)' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {mgrPhones.length === 0 && (
                  <div className="p-3 rounded-lg text-sm text-center" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                    No install manager phones configured.
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setMgrPhones([...mgrPhones, { name: '', phone: '' }])} className="btn btn-secondary text-sm">
                  + Add Phone
                </button>
                {JSON.stringify(mgrPhones) !== JSON.stringify(savedMgrPhones) && (
                  <>
                    <button
                      onClick={async () => {
                        setSavingMgr(true);
                        try {
                          const valid = mgrPhones.filter(p => p.name.trim() && p.phone.trim());
                          const res = await fetch('/api/settings/notifications', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ install_manager_phones: valid }),
                          });
                          if (res.ok) {
                            setSavedMgrPhones(valid);
                            setMgrPhones(valid);
                            setMgrMessage({ type: 'success', text: 'Saved!' });
                          } else {
                            setMgrMessage({ type: 'error', text: 'Failed to save' });
                          }
                        } finally {
                          setSavingMgr(false);
                          setTimeout(() => setMgrMessage(null), 3000);
                        }
                      }}
                      disabled={savingMgr}
                      className="btn btn-primary"
                      style={{ opacity: savingMgr ? 0.5 : 1 }}
                    >
                      {savingMgr ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setMgrPhones([...savedMgrPhones])} className="btn btn-secondary text-sm">
                      Discard
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Manager Emails */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
                Email Addresses
              </label>

              {mgrEmailMessage && (
                <div className="mb-3 p-2.5 rounded-lg text-sm" style={{
                  backgroundColor: mgrEmailMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: mgrEmailMessage.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
                }}>
                  {mgrEmailMessage.text}
                </div>
              )}

              <div className="space-y-2 mb-3">
                {mgrEmails.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      className="input text-sm flex-1"
                      placeholder="Name"
                      value={entry.name}
                      onChange={(e) => {
                        const next = [...mgrEmails];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setMgrEmails(next);
                      }}
                    />
                    <input
                      type="email"
                      className="input text-sm flex-1"
                      placeholder="email@example.com"
                      value={entry.email}
                      onChange={(e) => {
                        const next = [...mgrEmails];
                        next[idx] = { ...next[idx], email: e.target.value };
                        setMgrEmails(next);
                      }}
                    />
                    <button
                      onClick={() => setMgrEmails(mgrEmails.filter((_, i) => i !== idx))}
                      className="p-1.5 rounded hover:opacity-80"
                      style={{ color: 'var(--status-error)' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {mgrEmails.length === 0 && (
                  <div className="p-3 rounded-lg text-sm text-center" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                    No install manager emails configured.
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setMgrEmails([...mgrEmails, { name: '', email: '' }])} className="btn btn-secondary text-sm">
                  + Add Email
                </button>
                {JSON.stringify(mgrEmails) !== JSON.stringify(savedMgrEmails) && (
                  <>
                    <button
                      onClick={async () => {
                        setSavingMgrEmails(true);
                        try {
                          const valid = mgrEmails.filter(e => e.name.trim() && e.email.trim());
                          const res = await fetch('/api/settings/notifications', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ install_manager_emails: valid }),
                          });
                          if (res.ok) {
                            setSavedMgrEmails(valid);
                            setMgrEmails(valid);
                            setMgrEmailMessage({ type: 'success', text: 'Saved!' });
                          } else {
                            setMgrEmailMessage({ type: 'error', text: 'Failed to save' });
                          }
                        } finally {
                          setSavingMgrEmails(false);
                          setTimeout(() => setMgrEmailMessage(null), 3000);
                        }
                      }}
                      disabled={savingMgrEmails}
                      className="btn btn-primary"
                      style={{ opacity: savingMgrEmails ? 0.5 : 1 }}
                    >
                      {savingMgrEmails ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setMgrEmails([...savedMgrEmails])} className="btn btn-secondary text-sm">
                      Discard
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync History Tab */}
      {activeTab === 'history' && (
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
      )}
    </div>
  );
}
