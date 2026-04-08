'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import { formatTimestamp, formatCurrency } from '@/lib/ap-utils';
import { DEFAULT_TEMPLATES, TEMPLATE_KEYS, TEMPLATE_VARIABLES } from '@/lib/notification-templates';
import type { APTechnician } from '@/lib/supabase';

function TestSMSForm() {
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSend() {
    if (!phone.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          message: 'Test message from AP Payments (Dialpad)',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ type: 'error', text: data.error || 'Failed to send' });
      } else {
        setResult({ type: 'success', text: 'Test SMS sent successfully' });
      }
    } catch {
      setResult({ type: 'error', text: 'Network error' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="tel"
          placeholder="Phone number (e.g. 817-555-1234)"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !phone.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--christmas-green)', color: 'white' }}
        >
          {sending ? 'Sending...' : 'Send Test'}
        </button>
      </div>
      {result && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{
            backgroundColor: result.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: result.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
          }}
        >
          {result.text}
        </div>
      )}
    </div>
  );
}

function RecipientGroupSection({ title, description, phones, emails, onPhonesChange, onEmailsChange, onSave, hasChanges, onDiscard, loading }: {
  title: string;
  description: string;
  phones: { name: string; phone: string }[];
  emails: { name: string; email: string }[];
  onPhonesChange: (v: { name: string; phone: string }[]) => void;
  onEmailsChange: (v: { name: string; email: string }[]) => void;
  onSave: (phones: { name: string; phone: string }[], emails: { name: string; email: string }[]) => Promise<void>;
  hasChanges: boolean;
  onDiscard: () => void;
  loading: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expanded, setExpanded] = useState(false);

  const memberCount = Math.max(phones.length, emails.length);
  const summary = memberCount === 0 ? 'No recipients' : `${memberCount} recipient${memberCount === 1 ? '' : 's'}`;

  const maxLen = Math.max(phones.length, emails.length);
  const rows = Array.from({ length: maxLen }, (_, i) => ({
    name: phones[i]?.name || emails[i]?.name || '',
    phone: phones[i]?.phone || '',
    email: emails[i]?.email || '',
  }));

  const updateRow = (idx: number, field: 'name' | 'phone' | 'email', value: string) => {
    const newRows = [...rows];
    newRows[idx] = { ...newRows[idx], [field]: value };
    if (field === 'name') {
      onPhonesChange(newRows.map(r => ({ name: r.name, phone: r.phone })));
      onEmailsChange(newRows.map(r => ({ name: r.name, email: r.email })));
    } else if (field === 'phone') {
      onPhonesChange(newRows.map(r => ({ name: r.name, phone: r.phone })));
    } else {
      onEmailsChange(newRows.map(r => ({ name: r.name, email: r.email })));
    }
  };

  const addRow = () => {
    onPhonesChange([...phones, { name: '', phone: '' }]);
    onEmailsChange([...emails, { name: '', email: '' }]);
    setExpanded(true);
  };

  const removeRow = (idx: number) => {
    const newRows = rows.filter((_, i) => i !== idx);
    onPhonesChange(newRows.map(r => ({ name: r.name, phone: r.phone })));
    onEmailsChange(newRows.map(r => ({ name: r.name, email: r.email })));
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await onSave(phones, emails);
      setMsg({ type: 'success', text: 'Saved' });
      setTimeout(() => setMsg(null), 3000);
    } catch {
      setMsg({ type: 'error', text: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:opacity-90"
        onClick={() => setExpanded(!expanded)}
      >
        <svg
          className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
          style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <div className="flex-1">
          <div className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>{title}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{description}</div>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
          {summary}
        </span>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {msg && (
            <div className="mb-3 p-2.5 rounded-lg text-sm" style={{
              backgroundColor: msg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: msg.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
            }}>
              {msg.text}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 py-4" style={{ color: 'var(--text-muted)' }}>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          ) : (
            <>
              {rows.length > 0 && (
                <div className="flex items-center gap-2 mb-1 px-2">
                  <span className="flex-[2] text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Name</span>
                  <span className="flex-[2] text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Phone</span>
                  <span className="flex-[3] text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Email</span>
                  <span className="w-8" />
                </div>
              )}

              <div className="space-y-1.5 mb-3">
                {rows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-md" style={{ backgroundColor: 'var(--bg-primary)' }}>
                    <input
                      type="text"
                      placeholder="Name"
                      value={row.name}
                      onChange={e => updateRow(idx, 'name', e.target.value)}
                      className="flex-[2] text-sm py-1.5 px-2.5 rounded-md min-w-0"
                      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
                    />
                    <input
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={row.phone}
                      onChange={e => updateRow(idx, 'phone', e.target.value)}
                      className="flex-[2] text-sm py-1.5 px-2.5 rounded-md min-w-0"
                      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
                    />
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={row.email}
                      onChange={e => updateRow(idx, 'email', e.target.value)}
                      className="flex-[3] text-sm py-1.5 px-2.5 rounded-md min-w-0"
                      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
                    />
                    <button
                      onClick={() => removeRow(idx)}
                      className="p-1.5 rounded hover:opacity-80 flex-shrink-0"
                      style={{ color: 'var(--status-error)' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                {rows.length === 0 && (
                  <div className="p-3 rounded-md text-sm text-center" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                    No recipients configured.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button onClick={addRow} className="btn btn-secondary text-sm">+ Add Recipient</button>
                {hasChanges && (
                  <>
                    <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ opacity: saving ? 0.5 : 1 }}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={onDiscard} className="btn btn-secondary text-sm">Discard</button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

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

type SettingsTab = 'sync' | 'technicians' | 'trade-mapping' | 'notifications';

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

  // Notification toggles state
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [savedToggles, setSavedToggles] = useState<Record<string, boolean>>({});
  const [savingToggles, setSavingToggles] = useState(false);
  const [toggleMessage, setToggleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Notification log state
  const [smsLog, setSmsLog] = useState<{ id: string; recipient_phone: string; recipient_email: string | null; recipient_name: string | null; recipient_type: string; event_type: string; message: string; status: string; channel: string; created_at: string; job_id: string | null }[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'sms' | 'email'>('all');

  // Message templates state
  const [msgTemplates, setMsgTemplates] = useState<Record<string, string>>({});
  const [savedMsgTemplates, setSavedMsgTemplates] = useState<Record<string, string>>({});
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [templateMessage, setTemplateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Trade managers state (unified user-linked format)
  const [tradeManagers, setTradeManagers] = useState<{ user_id: string; name: string; email: string; phone: string; trade: 'hvac' | 'plumbing' }[]>([]);
  const [savedTradeManagers, setSavedTradeManagers] = useState<{ user_id: string; name: string; email: string; phone: string; trade: 'hvac' | 'plumbing' }[]>([]);
  const [portalUsers, setPortalUsers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [savingTradeManagers, setSavingTradeManagers] = useState(false);
  const [tradeManagerMessage, setTradeManagerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Manual sync
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      const [res, usersRes] = await Promise.all([
        fetch('/api/settings/notifications'),
        fetch('/api/users'),
      ]);
      if (res.ok) {
        const data = await res.json();
        const phones = data.notification_phones || [];
        setNotifPhones(phones);
        setSavedNotifPhones(phones);
        const emails = data.notification_emails || [];
        setNotifEmails(emails);
        setSavedNotifEmails(emails);
        const tm = data.trade_managers || [];
        setTradeManagers(tm);
        setSavedTradeManagers(tm);
        const t = data.notification_toggles || {};
        setToggles(t);
        setSavedToggles(t);
        const tpl = data.notification_templates || {};
        setMsgTemplates(tpl);
        setSavedMsgTemplates(tpl);
        setSmsLog(data.sms_log || []);
      }
      if (usersRes.ok) {
        setPortalUsers(await usersRes.json());
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
    } catch {
      setBackfillResult({ type: 'error', text: 'Backfill request failed' });
    } finally {
      setBackfilling(false);
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
  const hasToggleChanges = JSON.stringify(toggles) !== JSON.stringify(savedToggles);
  const hasTemplateChanges = JSON.stringify(msgTemplates) !== JSON.stringify(savedMsgTemplates);

  const getTemplateValue = (key: string) => {
    return msgTemplates[key] !== undefined ? msgTemplates[key] : DEFAULT_TEMPLATES[key] || '';
  };

  const handleTemplateChange = (key: string, value: string) => {
    setMsgTemplates(prev => ({ ...prev, [key]: value }));
  };

  const handleResetTemplate = (key: string) => {
    setMsgTemplates(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSaveTemplates = async () => {
    setSavingTemplates(true);
    setTemplateMessage(null);
    try {
      // Only save templates that differ from defaults
      const customTemplates: Record<string, string> = {};
      for (const [key, value] of Object.entries(msgTemplates)) {
        if (value !== DEFAULT_TEMPLATES[key]) {
          customTemplates[key] = value;
        }
      }
      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_templates: customTemplates }),
      });
      if (res.ok) {
        setSavedMsgTemplates({ ...customTemplates });
        setMsgTemplates({ ...customTemplates });
        setTemplateMessage({ type: 'success', text: 'Message templates saved' });
        setTimeout(() => setTemplateMessage(null), 4000);
      } else {
        setTemplateMessage({ type: 'error', text: 'Failed to save templates' });
      }
    } catch {
      setTemplateMessage({ type: 'error', text: 'Failed to save templates' });
    } finally {
      setSavingTemplates(false);
    }
  };

  const insertVariable = (key: string, variable: string) => {
    const textarea = document.getElementById(`template-${key}`) as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = getTemplateValue(key);
    const newValue = current.substring(0, start) + variable + current.substring(end);
    handleTemplateChange(key, newValue);
    // Restore cursor position after React re-render
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const notificationTypes: { key: string; label: string; description: string; channels: ('sms' | 'email')[]; templateKey: string; subjectKey?: string }[] = [
    { key: 'pending_approval_manager', label: 'Pending Approval → Trade Managers', description: 'Notify HVAC or Plumbing managers when invoice needs approval', channels: ['sms', 'email'], templateKey: 'pending_approval_manager', subjectKey: 'subject_pending_approval_manager' },
    { key: 'ready_to_pay_internal', label: 'Ready to Pay → AP Team', description: 'Notify AP team when invoice is approved', channels: ['sms', 'email'], templateKey: 'ready_to_pay_internal', subjectKey: 'subject_ready_to_pay_internal' },
    { key: 'paid_contractor', label: 'Paid → Contractor', description: 'Notify contractor when payment is sent', channels: ['sms', 'email'], templateKey: 'paid_contractor', subjectKey: 'subject_paid_contractor' },
    { key: 'paid_internal', label: 'Paid → AP Team', description: 'Notify AP team when payment is marked paid', channels: ['sms', 'email'], templateKey: 'paid_internal', subjectKey: 'subject_paid_internal' },
    { key: 'paid_manager', label: 'Paid → Trade Managers', description: 'Notify trade managers when payment is marked paid', channels: ['sms', 'email'], templateKey: 'paid_manager', subjectKey: 'subject_paid_manager' },
    { key: 'daily_reminder_manager', label: 'Daily Approval Reminder → Trade Managers', description: 'Daily 8am reminder for managers with outstanding approvals (Mon–Fri)', channels: ['sms', 'email'], templateKey: 'daily_reminder_manager', subjectKey: 'subject_daily_reminder_manager' },
  ];

  const [expandedNotif, setExpandedNotif] = useState<string | null>(null);

  const handleChannelToggle = (key: string, channel: 'sms' | 'email') => {
    const toggleKey = `${key}_${channel}`;
    setToggles(prev => ({ ...prev, [toggleKey]: prev[toggleKey] === false ? true : false }));
  };

  const isChannelEnabled = (key: string, channel: 'sms' | 'email') => {
    const toggleKey = `${key}_${channel}`;
    if (toggleKey in toggles) return toggles[toggleKey] !== false;
    // Legacy fallback: check the old key
    return toggles[key] !== false;
  };

  const handleSaveToggles = async () => {
    setSavingToggles(true);
    setToggleMessage(null);
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_toggles: toggles }),
      });
      if (res.ok) {
        setSavedToggles({ ...toggles });
        setToggleMessage({ type: 'success', text: 'Notification settings saved' });
        setTimeout(() => setToggleMessage(null), 4000);
      } else {
        setToggleMessage({ type: 'error', text: 'Failed to save' });
      }
    } catch {
      setToggleMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSavingToggles(false);
    }
  };

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
      )}

      {/* Technicians Tab */}
      {activeTab === 'technicians' && (
        <div className="space-y-6">
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
                <span>These rates are used only when a technician has no individual rate set. Individual technician rates always take priority.</span>
              </div>
            </div>
          </div>
        </div>
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
        <div className="space-y-6">

        {/* Test SMS */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>
            Test SMS (Dialpad)
          </h2>
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            Send a test message to verify Dialpad SMS is working.
          </p>
          <TestSMSForm />
        </div>

        {/* Notification Types */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>
            Notification Types
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Configure delivery channels and message templates per event. Click a row to edit its template.
          </p>

          {(toggleMessage || templateMessage) && (
            <div
              className="mb-4 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: (toggleMessage || templateMessage)?.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: (toggleMessage || templateMessage)?.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
              }}
            >
              {(toggleMessage || templateMessage)?.text}
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
                {notificationTypes.map(({ key, label, description, channels, templateKey, subjectKey }) => {
                  const isExpanded = expandedNotif === key;
                  const smsOn = channels.includes('sms') && isChannelEnabled(key, 'sms');
                  const emailOn = channels.includes('email') && isChannelEnabled(key, 'email');
                  const anyOn = smsOn || emailOn;
                  const msgValue = getTemplateValue(templateKey);
                  const msgIsCustom = msgTemplates[templateKey] !== undefined && msgTemplates[templateKey] !== DEFAULT_TEMPLATES[templateKey];
                  const subjectValue = subjectKey ? getTemplateValue(subjectKey) : '';
                  const subjectIsCustom = subjectKey ? (msgTemplates[subjectKey] !== undefined && msgTemplates[subjectKey] !== DEFAULT_TEMPLATES[subjectKey]) : false;

                  return (
                    <div
                      key={key}
                      className="rounded-lg overflow-hidden"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      {/* Header row */}
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:opacity-90"
                        onClick={() => setExpandedNotif(isExpanded ? null : key)}
                      >
                        <svg
                          className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
                          style={{ color: 'var(--text-muted)', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium" style={{ color: anyOn ? 'var(--christmas-cream)' : 'var(--text-muted)' }}>
                            {label}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {description}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          {channels.includes('sms') && (
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={smsOn}
                                onChange={() => handleChannelToggle(key, 'sms')}
                                className="w-3.5 h-3.5 rounded"
                                style={{ accentColor: 'var(--christmas-green)' }}
                              />
                              <span className="text-[11px]" style={{ color: smsOn ? 'var(--christmas-cream)' : 'var(--text-muted)' }}>
                                Text
                              </span>
                            </label>
                          )}
                          {channels.includes('email') && (
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={emailOn}
                                onChange={() => handleChannelToggle(key, 'email')}
                                className="w-3.5 h-3.5 rounded"
                                style={{ accentColor: 'var(--christmas-green)' }}
                              />
                              <span className="text-[11px]" style={{ color: emailOn ? 'var(--christmas-cream)' : 'var(--text-muted)' }}>
                                Email
                              </span>
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Expanded template editor */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 space-y-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          {/* Message body */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                Message Body
                              </label>
                              {msgIsCustom && (
                                <button
                                  onClick={() => handleResetTemplate(templateKey)}
                                  className="text-[10px] px-1.5 py-0.5 rounded"
                                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                            <textarea
                              id={`template-${templateKey}`}
                              value={msgValue}
                              onChange={e => handleTemplateChange(templateKey, e.target.value)}
                              rows={2}
                              className="w-full text-sm py-2 px-3 rounded-md resize-y"
                              style={{
                                backgroundColor: 'var(--bg-primary)',
                                color: 'var(--christmas-cream)',
                                border: `1px solid ${msgIsCustom ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                lineHeight: '1.5',
                              }}
                            />
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {TEMPLATE_VARIABLES.map(v => (
                                <button
                                  key={v}
                                  onClick={() => insertVariable(templateKey, v)}
                                  className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80"
                                  style={{
                                    backgroundColor: 'rgba(93, 138, 102, 0.15)',
                                    color: 'var(--christmas-green-light)',
                                    border: '1px solid rgba(93, 138, 102, 0.25)',
                                  }}
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Email subject */}
                          {subjectKey && (
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                  Email Subject
                                </label>
                                {subjectIsCustom && (
                                  <button
                                    onClick={() => handleResetTemplate(subjectKey)}
                                    className="text-[10px] px-1.5 py-0.5 rounded"
                                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                              <input
                                type="text"
                                id={`template-${subjectKey}`}
                                value={subjectValue}
                                onChange={e => handleTemplateChange(subjectKey, e.target.value)}
                                className="w-full text-sm py-1.5 px-3 rounded-md"
                                style={{
                                  backgroundColor: 'var(--bg-primary)',
                                  color: 'var(--christmas-cream)',
                                  border: `1px solid ${subjectIsCustom ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
                                  fontFamily: 'monospace',
                                  fontSize: '12px',
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {(hasToggleChanges || hasTemplateChanges) && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      if (hasToggleChanges) await handleSaveToggles();
                      if (hasTemplateChanges) await handleSaveTemplates();
                    }}
                    disabled={savingToggles || savingTemplates}
                    className="btn btn-primary"
                    style={{ opacity: (savingToggles || savingTemplates) ? 0.5 : 1 }}
                  >
                    {(savingToggles || savingTemplates) ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setToggles({ ...savedToggles });
                      setMsgTemplates({ ...savedMsgTemplates });
                    }}
                    className="btn btn-secondary text-sm"
                  >
                    Discard
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Recipients */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>
            Recipients
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Configure who receives notifications for each group.
          </p>

          <div className="space-y-2">
            <RecipientGroupSection
              title="AP Team"
              description="Receives ready-to-pay and paid notifications."
              phones={notifPhones}
              emails={notifEmails}
              onPhonesChange={setNotifPhones}
              onEmailsChange={setNotifEmails}
              onSave={async (phones, emails) => {
                const validPhones = phones.filter(p => p.name.trim() && p.phone.trim());
                const validEmails = emails.filter(e => e.name.trim() && e.email.trim());
                const res = await fetch('/api/settings/notifications', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ notification_phones: validPhones, notification_emails: validEmails }),
                });
                if (!res.ok) throw new Error('Failed to save');
                setNotifPhones(validPhones);
                setSavedNotifPhones([...validPhones]);
                setNotifEmails(validEmails);
                setSavedNotifEmails([...validEmails]);
              }}
              hasChanges={hasNotifChanges || hasEmailChanges}
              onDiscard={() => { setNotifPhones([...savedNotifPhones]); setNotifEmails([...savedNotifEmails]); }}
              loading={loadingNotif}
            />

            {/* Trade Managers - linked to portal users */}
            <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div className="p-3">
                <div className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>Trade Managers</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Receives approval requests and daily reminders. Linked to portal user accounts.</div>
              </div>
              <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                {tradeManagerMessage && (
                  <div className="mb-3 p-2.5 rounded-lg text-sm" style={{
                    backgroundColor: tradeManagerMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: tradeManagerMessage.type === 'success' ? 'var(--status-success)' : 'var(--status-error)',
                  }}>
                    {tradeManagerMessage.text}
                  </div>
                )}

                {tradeManagers.length > 0 && (
                  <div className="flex items-center gap-2 mb-1 px-2">
                    <span className="flex-[3] text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>User</span>
                    <span className="flex-[2] text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Trade</span>
                    <span className="flex-[2] text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Phone</span>
                    <span className="flex-[3] text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Email</span>
                    <span className="w-8" />
                  </div>
                )}

                <div className="space-y-1.5 mb-3">
                  {tradeManagers.map((mgr, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-md" style={{ backgroundColor: 'var(--bg-primary)' }}>
                      <select
                        value={mgr.user_id}
                        onChange={e => {
                          const user = portalUsers.find(u => u.id === e.target.value);
                          if (user) {
                            setTradeManagers(prev => prev.map((m, i) => i === idx ? { ...m, user_id: user.id, name: user.name || '', email: user.email } : m));
                          }
                        }}
                        className="flex-[3] text-sm py-1.5 px-2.5 rounded-md min-w-0"
                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
                      >
                        <option value="">Select user...</option>
                        {portalUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.name || u.email}</option>
                        ))}
                      </select>
                      <select
                        value={mgr.trade}
                        onChange={e => setTradeManagers(prev => prev.map((m, i) => i === idx ? { ...m, trade: e.target.value as 'hvac' | 'plumbing' } : m))}
                        className="flex-[2] text-sm py-1.5 px-2.5 rounded-md min-w-0"
                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
                      >
                        <option value="hvac">HVAC</option>
                        <option value="plumbing">Plumbing</option>
                      </select>
                      <input
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={mgr.phone}
                        onChange={e => setTradeManagers(prev => prev.map((m, i) => i === idx ? { ...m, phone: e.target.value } : m))}
                        className="flex-[2] text-sm py-1.5 px-2.5 rounded-md min-w-0"
                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
                      />
                      <input
                        type="email"
                        value={mgr.email}
                        readOnly
                        className="flex-[3] text-sm py-1.5 px-2.5 rounded-md min-w-0 cursor-not-allowed"
                        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', opacity: 0.7 }}
                      />
                      <button
                        onClick={() => setTradeManagers(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 rounded hover:opacity-80 flex-shrink-0"
                        style={{ color: 'var(--status-error)' }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  {tradeManagers.length === 0 && (
                    <div className="p-3 rounded-md text-sm text-center" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                      No trade managers configured. Add a user to receive approval notifications.
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setTradeManagers(prev => [...prev, { user_id: '', name: '', email: '', phone: '', trade: 'hvac' }])}
                    className="btn btn-secondary text-sm"
                  >
                    + Add Trade Manager
                  </button>
                  {JSON.stringify(tradeManagers) !== JSON.stringify(savedTradeManagers) && (
                    <>
                      <button
                        onClick={async () => {
                          setSavingTradeManagers(true);
                          setTradeManagerMessage(null);
                          try {
                            const valid = tradeManagers.filter(m => m.user_id && m.name);
                            const res = await fetch('/api/settings/notifications', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ trade_managers: valid }),
                            });
                            if (res.ok) {
                              setTradeManagers(valid);
                              setSavedTradeManagers([...valid]);
                              setTradeManagerMessage({ type: 'success', text: 'Trade managers saved' });
                              setTimeout(() => setTradeManagerMessage(null), 3000);
                            } else {
                              setTradeManagerMessage({ type: 'error', text: 'Failed to save' });
                            }
                          } catch {
                            setTradeManagerMessage({ type: 'error', text: 'Failed to save' });
                          } finally {
                            setSavingTradeManagers(false);
                          }
                        }}
                        disabled={savingTradeManagers}
                        className="btn btn-primary"
                        style={{ opacity: savingTradeManagers ? 0.5 : 1 }}
                      >
                        {savingTradeManagers ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setTradeManagers([...savedTradeManagers])}
                        className="btn btn-secondary text-sm"
                      >
                        Discard
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SMS / Email Log */}
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              Recent Notifications
            </h2>
            <div className="flex gap-1">
              {(['all', 'sms', 'email'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setLogFilter(f)}
                  className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: logFilter === f ? 'rgba(93, 138, 102, 0.25)' : 'transparent',
                    color: logFilter === f ? 'var(--christmas-green-light)' : 'var(--text-muted)',
                    border: logFilter === f ? '1px solid rgba(93, 138, 102, 0.4)' : '1px solid transparent',
                  }}
                >
                  {f === 'all' ? 'All' : f === 'sms' ? 'Text' : 'Email'}
                </button>
              ))}
            </div>
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Last 50 notifications sent by the system.
          </p>

          {(() => {
            const filtered = logFilter === 'all' ? smsLog : smsLog.filter(s => s.channel === logFilter);
            return filtered.length === 0 ? (
              <div className="p-4 rounded-lg text-sm text-center" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                No notifications sent yet.
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Channel</th>
                      <th>Recipient</th>
                      <th>Type</th>
                      <th>Event</th>
                      <th>Status</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(entry => (
                      <tr key={entry.id}>
                        <td className="text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                          {formatTimestamp(entry.created_at)}
                        </td>
                        <td>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: entry.channel === 'email' ? 'rgba(99, 149, 237, 0.15)' : 'rgba(184, 149, 107, 0.15)',
                              color: entry.channel === 'email' ? '#6395ED' : 'var(--christmas-gold)',
                            }}
                          >
                            {entry.channel === 'email' ? 'Email' : 'Text'}
                          </span>
                        </td>
                        <td className="text-sm" style={{ color: 'var(--christmas-cream)' }}>
                          <div>{entry.recipient_name || entry.recipient_phone || entry.recipient_email}</div>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {entry.channel === 'email' ? entry.recipient_email : entry.recipient_phone}
                          </div>
                        </td>
                        <td>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: entry.recipient_type === 'contractor' ? 'rgba(184, 149, 107, 0.15)' : 'rgba(93, 138, 102, 0.15)',
                              color: entry.recipient_type === 'contractor' ? 'var(--christmas-gold)' : 'var(--christmas-green-light)',
                            }}
                          >
                            {entry.recipient_type}
                          </span>
                        </td>
                        <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {entry.event_type}
                        </td>
                        <td>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: entry.status === 'sent' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: entry.status === 'sent' ? 'var(--status-success)' : 'var(--status-error)',
                            }}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td className="text-xs max-w-[200px] truncate" style={{ color: 'var(--text-muted)' }} title={entry.message}>
                          {entry.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
        </div>
      )}

    </div>
  );
}
