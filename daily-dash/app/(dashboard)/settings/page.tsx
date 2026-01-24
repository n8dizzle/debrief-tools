'use client';

import { useState, useEffect } from 'react';

// Sheet cell mappings for reference
const sheetMappings = {
  'Monthly Revenue': {
    range: 'B5:N9',
    departments: ['HVAC Install', 'HVAC Service', 'HVAC Maintenance', 'Plumbing', 'TOTAL'],
  },
  'Business Days': {
    range: 'B12:M12',
    description: 'Business days per month (with 0.5 Saturdays)',
  },
  'Daily Revenue': {
    range: 'B16:N20',
    departments: ['HVAC Install', 'HVAC Service', 'HVAC Maintenance', 'Plumbing', 'TOTAL'],
  },
  'Avg Ticket': {
    range: 'A24:A27',
    departments: ['HVAC Install', 'HVAC Service', 'HVAC Maintenance', 'Plumbing'],
  },
  'Monthly Jobs': {
    range: 'B24:N28',
    departments: ['HVAC Install', 'HVAC Service', 'HVAC Maintenance', 'Plumbing', 'TOTAL'],
  },
  'Daily Jobs': {
    range: 'B39:N43',
    departments: ['HVAC Install', 'HVAC Service', 'HVAC Maintenance', 'Plumbing', 'TOTAL'],
  },
};

// Business days per month (2026)
const businessDaysPerMonth = [22, 19, 22, 22, 21, 22, 23, 21, 21, 23, 19, 23];

// Monthly revenue targets (in dollars)
const MONTHLY_TARGETS = {
  'HVAC Install': [569000, 429000, 633000, 858000, 1230000, 1450000, 1430000, 1470000, 805000, 708000, 574000, 574000],
  'HVAC Service': [124000, 94000, 139000, 188000, 270000, 317000, 312000, 322000, 176000, 155000, 126000, 126000],
  'HVAC Maintenance': [31000, 23000, 35000, 47000, 68000, 79000, 78000, 80000, 44000, 39000, 31000, 31000],
  'Plumbing': [130000, 156000, 156000, 156000, 156000, 156000, 183000, 183000, 183000, 209000, 209000, 209000],
  'TOTAL': [855000, 703000, 963000, 1250000, 1730000, 2000000, 2000000, 2050000, 1210000, 1110000, 940000, 940000],
};

// Calculate daily targets from monthly / business days
const calcDaily = (monthly: number[], days: number[]) => monthly.map((m, i) => Math.round(m / days[i]));
const calcWeekly = (daily: number[]) => daily.map(d => d * 5);
const formatCurrency = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}K`.replace(/\.0K$/, 'K') : `$${n.toLocaleString()}`;
const formatCurrencyFull = (n: number) => `$${n.toLocaleString()}`;

// Daily Revenue Targets (calculated from monthly / business days)
const dailyRevenueTargets = [
  { name: 'HVAC Install', values: [...calcDaily(MONTHLY_TARGETS['HVAC Install'], businessDaysPerMonth).map(formatCurrencyFull), formatCurrencyFull(Math.round(MONTHLY_TARGETS['HVAC Install'].reduce((a, b) => a + b, 0) / businessDaysPerMonth.reduce((a, b) => a + b, 0)))] },
  { name: 'HVAC Service', values: [...calcDaily(MONTHLY_TARGETS['HVAC Service'], businessDaysPerMonth).map(formatCurrencyFull), formatCurrencyFull(Math.round(MONTHLY_TARGETS['HVAC Service'].reduce((a, b) => a + b, 0) / businessDaysPerMonth.reduce((a, b) => a + b, 0)))] },
  { name: 'HVAC Maint.', values: [...calcDaily(MONTHLY_TARGETS['HVAC Maintenance'], businessDaysPerMonth).map(formatCurrencyFull), formatCurrencyFull(Math.round(MONTHLY_TARGETS['HVAC Maintenance'].reduce((a, b) => a + b, 0) / businessDaysPerMonth.reduce((a, b) => a + b, 0)))] },
  { name: 'Plumbing', values: [...calcDaily(MONTHLY_TARGETS['Plumbing'], businessDaysPerMonth).map(formatCurrencyFull), formatCurrencyFull(Math.round(MONTHLY_TARGETS['Plumbing'].reduce((a, b) => a + b, 0) / businessDaysPerMonth.reduce((a, b) => a + b, 0)))] },
  { name: 'TOTAL', values: [...calcDaily(MONTHLY_TARGETS['TOTAL'], businessDaysPerMonth).map(formatCurrencyFull), formatCurrencyFull(Math.round(MONTHLY_TARGETS['TOTAL'].reduce((a, b) => a + b, 0) / businessDaysPerMonth.reduce((a, b) => a + b, 0)))], isTotal: true },
];

// Weekly Revenue Targets (Daily × 5 business days)
const weeklyRevenueTargets = [
  { name: 'HVAC Install', values: [...calcWeekly(calcDaily(MONTHLY_TARGETS['HVAC Install'], businessDaysPerMonth)).map(formatCurrencyFull), formatCurrencyFull(Math.round(MONTHLY_TARGETS['HVAC Install'].reduce((a, b) => a + b, 0) / businessDaysPerMonth.reduce((a, b) => a + b, 0)) * 5)] },
  { name: 'HVAC Service', values: [...calcWeekly(calcDaily(MONTHLY_TARGETS['HVAC Service'], businessDaysPerMonth)).map(formatCurrencyFull), formatCurrencyFull(Math.round(MONTHLY_TARGETS['HVAC Service'].reduce((a, b) => a + b, 0) / businessDaysPerMonth.reduce((a, b) => a + b, 0)) * 5)] },
  { name: 'HVAC Maint.', values: [...calcWeekly(calcDaily(MONTHLY_TARGETS['HVAC Maintenance'], businessDaysPerMonth)).map(formatCurrencyFull), formatCurrencyFull(Math.round(MONTHLY_TARGETS['HVAC Maintenance'].reduce((a, b) => a + b, 0) / businessDaysPerMonth.reduce((a, b) => a + b, 0)) * 5)] },
  { name: 'Plumbing', values: [...calcWeekly(calcDaily(MONTHLY_TARGETS['Plumbing'], businessDaysPerMonth)).map(formatCurrencyFull), formatCurrencyFull(Math.round(MONTHLY_TARGETS['Plumbing'].reduce((a, b) => a + b, 0) / businessDaysPerMonth.reduce((a, b) => a + b, 0)) * 5)] },
  { name: 'TOTAL', values: [...calcWeekly(calcDaily(MONTHLY_TARGETS['TOTAL'], businessDaysPerMonth)).map(formatCurrencyFull), formatCurrencyFull(Math.round(MONTHLY_TARGETS['TOTAL'].reduce((a, b) => a + b, 0) / businessDaysPerMonth.reduce((a, b) => a + b, 0)) * 5)], isTotal: true },
];

// Review Targets from spreadsheet
const reviewTargets = {
  monthly: [68, 56, 76, 99, 137, 159, 159, 163, 96, 88, 75, 75],
  daily: [3, 3, 3, 4, 6, 7, 7, 7, 4, 4, 3, 4],
  annual: 1250,
};

const kpiDefinitions = [
  // Christmas Overall
  { name: 'Jobs Scheduled', department: 'Christmas', source: 'ServiceTitan', targetType: 'daily', target: '45' },
  { name: 'Yesterday Sales', department: 'Christmas', source: 'ServiceTitan', targetType: 'daily', target: 'From Sheet' },
  { name: 'Revenue Completed', department: 'Christmas', source: 'ServiceTitan', targetType: 'daily', target: 'From Sheet' },

  // HVAC Service
  { name: 'Jobs Completed', department: 'HVAC Service', source: 'ServiceTitan', targetType: 'daily', target: 'From Sheet' },
  { name: 'Average Ticket', department: 'HVAC Service', source: 'ServiceTitan', targetType: 'fixed', target: '$450' },
  { name: 'Zero Dollar %', department: 'HVAC Service', source: 'ServiceTitan', targetType: 'daily', target: '<5%' },
  { name: 'Leads Set', department: 'HVAC Service', source: 'ServiceTitan', targetType: 'daily', target: '8' },
  { name: 'Recalls', department: 'HVAC Service', source: 'ServiceTitan', targetType: 'daily', target: '<2' },

  // HVAC Install
  { name: 'Installs Scheduled', department: 'HVAC Install', source: 'ServiceTitan', targetType: 'daily', target: 'From Sheet' },
  { name: 'Installs Completed', department: 'HVAC Install', source: 'ServiceTitan', targetType: 'daily', target: 'From Sheet' },
  { name: 'Install Revenue', department: 'HVAC Install', source: 'ServiceTitan', targetType: 'daily', target: 'From Sheet' },
  { name: 'Quality Issues', department: 'HVAC Install', source: 'Manual', targetType: 'daily', target: '<1' },

  // Plumbing
  { name: 'Plumbing Sales', department: 'Plumbing', source: 'ServiceTitan', targetType: 'daily', target: 'From Sheet' },
  { name: 'Plumbing Revenue', department: 'Plumbing', source: 'ServiceTitan', targetType: 'daily', target: 'From Sheet' },
  { name: 'Jobs Ran', department: 'Plumbing', source: 'ServiceTitan', targetType: 'daily', target: 'From Sheet' },
  { name: 'Average Ticket', department: 'Plumbing', source: 'ServiceTitan', targetType: 'fixed', target: '$775' },
  { name: 'Conversion Rate', department: 'Plumbing', source: 'Calculated', targetType: 'daily', target: '65%' },

  // Call Center
  { name: 'Calls Answered', department: 'Call Center', source: 'Google Sheet', targetType: 'daily', target: '200' },
  { name: 'Booking %', department: 'Call Center', source: 'Google Sheet', targetType: 'daily', target: '75%' },
  { name: 'Abandon Rate', department: 'Call Center', source: 'Google Sheet', targetType: 'daily', target: '<5%' },
  { name: 'Avg Hold Time', department: 'Call Center', source: 'Google Sheet', targetType: 'daily', target: '<60s' },

  // Marketing
  { name: 'Leads', department: 'Marketing', source: 'Google Sheet', targetType: 'daily', target: '50' },
  { name: 'New Customers', department: 'Marketing', source: 'ServiceTitan', targetType: 'daily', target: '15' },
  { name: 'New Reviews', department: 'Marketing', source: 'Google Sheet', targetType: 'daily', target: '3' },

  // Finance
  { name: 'Total AR', department: 'Finance', source: 'Google Sheet', targetType: 'snapshot', target: '<$150K' },
  { name: 'AR Invoices', department: 'Finance', source: 'Google Sheet', targetType: 'snapshot', target: '<50' },
  { name: 'Gross Margin', department: 'Finance', source: 'Google Sheet', targetType: 'monthly', target: '45%' },
];

function SourceBadge({ source }: { source: string }) {
  const config: Record<string, { bg: string; text: string; icon: string }> = {
    ServiceTitan: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', icon: '⚡' },
    'Google Sheet': { bg: 'rgba(74, 222, 128, 0.15)', text: '#4ADE80', icon: '📊' },
    Manual: { bg: 'rgba(184, 149, 107, 0.15)', text: 'var(--christmas-gold)', icon: '✏️' },
    Calculated: { bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7', icon: '🔢' },
  };

  const { bg, text, icon } = config[source] || config.Manual;

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
      style={{ backgroundColor: bg, color: text }}
    >
      {icon} {source}
    </span>
  );
}

export default function SettingsPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'kpis' | 'targets' | 'sheets' | 'data'>('targets');

  const [syncResult, setSyncResult] = useState<{ message?: string; error?: string } | null>(null);

  // Trade sync state
  const [isSyncingTrades, setIsSyncingTrades] = useState(false);
  const [tradeSyncResult, setTradeSyncResult] = useState<{ message?: string; error?: string } | null>(null);
  const [tradeSyncedDates, setTradeSyncedDates] = useState<string[]>([]);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch('/api/targets/sync', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setLastSync(new Date().toLocaleString());
        setSyncResult({ message: `Synced ${data.recordsSynced?.total || 0} records from Google Sheets` });
      } else if (data.hint) {
        // No credentials - offer to seed instead
        setSyncResult({ error: data.message });
      } else {
        setSyncResult({ error: data.error || 'Sync failed' });
      }
    } catch (err) {
      setSyncResult({ error: 'Failed to connect to sync API' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSeed = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch('/api/targets/seed', { method: 'POST' });
      const data = await response.json();
      console.log('Seed response:', data);

      if (data.success) {
        setLastSync(new Date().toLocaleString());
        const errorsMsg = data.errors?.length > 0 ? ` (${data.errors.length} errors: ${data.errors.slice(0, 3).join(', ')})` : '';
        setSyncResult({ message: data.message + errorsMsg });
      } else {
        setSyncResult({ error: `${data.error || 'Seed failed'}${data.errors?.length ? `: ${data.errors.slice(0,3).join(', ')}` : ''}` });
      }
    } catch (err) {
      console.error('Seed error:', err);
      setSyncResult({ error: 'Failed to seed data' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFixTargets = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch('/api/targets/fix', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setLastSync(new Date().toLocaleString());
        const janChristmas = data.january?.find((j: { department: string }) => j.department === 'christmas');
        setSyncResult({
          message: `Fixed ${data.totalRecords} targets. January daily: $${janChristmas?.daily?.toLocaleString() || 'N/A'}`
        });
      } else {
        setSyncResult({ error: data.errors?.join(', ') || 'Fix failed' });
      }
    } catch (err) {
      setSyncResult({ error: 'Failed to fix targets' });
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch trade sync status on mount
  useEffect(() => {
    const fetchTradeSyncStatus = async () => {
      try {
        const response = await fetch('/api/trades/sync');
        const data = await response.json();
        if (data.syncedDates) {
          setTradeSyncedDates(data.syncedDates);
        }
      } catch (err) {
        console.error('Failed to fetch trade sync status:', err);
      }
    };
    fetchTradeSyncStatus();
  }, []);

  const handleTradeSyncBackfill = async (days: number) => {
    setIsSyncingTrades(true);
    setTradeSyncResult(null);
    try {
      const response = await fetch('/api/trades/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backfillDays: days }),
      });
      const data = await response.json();

      const successCount = data.results?.filter((r: { success: boolean }) => r.success).length || 0;
      const failCount = data.results?.filter((r: { success: boolean }) => !r.success).length || 0;

      if (failCount === 0) {
        setTradeSyncResult({ message: `Successfully synced ${successCount} days of trade data` });
      } else {
        setTradeSyncResult({ message: `Synced ${successCount} days, ${failCount} failed` });
      }

      // Refresh synced dates
      const statusResponse = await fetch('/api/trades/sync');
      const statusData = await statusResponse.json();
      if (statusData.syncedDates) {
        setTradeSyncedDates(statusData.syncedDates);
      }
    } catch (err) {
      setTradeSyncResult({ error: 'Failed to sync trade data' });
    } finally {
      setIsSyncingTrades(false);
    }
  };

  const handleTradeSyncYesterday = async () => {
    setIsSyncingTrades(true);
    setTradeSyncResult(null);
    try {
      const response = await fetch('/api/trades/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // defaults to yesterday
      });
      const data = await response.json();

      if (data.results?.[0]?.success) {
        setTradeSyncResult({ message: `Synced trade data for ${data.results[0].date}` });
      } else {
        setTradeSyncResult({ error: data.results?.[0]?.error || 'Sync failed' });
      }

      // Refresh synced dates
      const statusResponse = await fetch('/api/trades/sync');
      const statusData = await statusResponse.json();
      if (statusData.syncedDates) {
        setTradeSyncedDates(statusData.syncedDates);
      }
    } catch (err) {
      setTradeSyncResult({ error: 'Failed to sync trade data' });
    } finally {
      setIsSyncingTrades(false);
    }
  };

  const tabs = [
    { id: 'targets', label: 'Revenue Targets' },
    { id: 'kpis', label: 'KPI Definitions' },
    { id: 'sheets', label: 'Sheet Mappings' },
    { id: 'data', label: 'Data Sync' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--christmas-cream)' }}
          >
            Settings
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            KPI definitions, targets, and data sources
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleFixTargets}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              opacity: isSyncing ? 0.7 : 1,
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Fix Targets
          </button>
          <button
            onClick={handleSeed}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--christmas-gold)',
              color: 'var(--bg-primary)',
              opacity: isSyncing ? 0.7 : 1,
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            Seed Data
          </button>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--christmas-green)',
              color: 'var(--christmas-cream)',
              opacity: isSyncing ? 0.7 : 1,
            }}
          >
            <svg
              className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isSyncing ? 'Syncing...' : 'Sync from Google Sheets'}
          </button>
        </div>
      </div>

      {lastSync && (
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Last synced: {lastSync}
        </p>
      )}

      {syncResult && (
        <div
          className="p-3 rounded-lg mb-6 text-sm"
          style={{
            backgroundColor: syncResult.error
              ? 'rgba(220, 38, 38, 0.1)'
              : 'rgba(74, 222, 128, 0.1)',
            border: `1px solid ${syncResult.error ? 'rgba(220, 38, 38, 0.3)' : 'rgba(74, 222, 128, 0.3)'}`,
            color: syncResult.error ? '#dc2626' : '#4ADE80',
          }}
        >
          {syncResult.message || syncResult.error}
        </div>
      )}

      {/* Data Source Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(74, 222, 128, 0.15)' }}>
              <span className="text-lg">📊</span>
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>Google Sheets</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>2026 Targets & Actuals</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Connected</span>
          </div>
        </div>

        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>
              <span className="text-lg">⚡</span>
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>ServiceTitan</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Jobs, Revenue, Tickets</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Connected</span>
          </div>
        </div>

        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(184, 149, 107, 0.15)' }}>
              <span className="text-lg">📅</span>
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>Business Days</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Holidays & Schedule</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>From Sheet</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className="px-4 py-2 text-sm rounded-lg transition-colors"
            style={{
              backgroundColor: activeTab === tab.id ? 'var(--christmas-green)' : 'var(--bg-card)',
              color: activeTab === tab.id ? 'var(--christmas-cream)' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Revenue Targets Tab */}
      {activeTab === 'targets' && (
        <>
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              Monthly Revenue Targets
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Source: Google Sheet (2026 Targets & Actuals) • Range: B5:N9
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Department</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Jan</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Feb</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Mar</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Apr</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>May</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Jun</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Jul</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Aug</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Sep</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Oct</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Nov</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Dec</th>
                  <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--christmas-gold)' }}>Annual</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'HVAC Install', values: ['$569K', '$429K', '$633K', '$858K', '$1.23M', '$1.45M', '$1.43M', '$1.47M', '$805K', '$708K', '$574K', '$574K', '$10.7M'] },
                  { name: 'HVAC Service', values: ['$124K', '$94K', '$139K', '$188K', '$270K', '$317K', '$312K', '$322K', '$176K', '$155K', '$126K', '$126K', '$2.35M'] },
                  { name: 'HVAC Maint.', values: ['$31K', '$23K', '$35K', '$47K', '$68K', '$79K', '$78K', '$80K', '$44K', '$39K', '$31K', '$31K', '$587K'] },
                  { name: 'Plumbing', values: ['$130K', '$156K', '$156K', '$156K', '$156K', '$156K', '$183K', '$183K', '$183K', '$209K', '$209K', '$209K', '$2.09M'] },
                  { name: 'TOTAL', values: ['$855K', '$703K', '$963K', '$1.25M', '$1.73M', '$2.0M', '$2.0M', '$2.05M', '$1.21M', '$1.11M', '$940K', '$940K', '$15.75M'], isTotal: true },
                ].map((row, idx) => (
                  <tr
                    key={row.name}
                    style={{
                      borderBottom: idx < 4 ? '1px solid var(--border-subtle)' : 'none',
                      backgroundColor: row.isTotal ? 'var(--bg-card)' : 'transparent',
                    }}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: row.isTotal ? 'var(--christmas-cream)' : 'var(--text-secondary)' }}>
                      {row.name}
                    </td>
                    {row.values.map((val, i) => (
                      <td
                        key={i}
                        className="text-right px-3 py-3"
                        style={{ color: i === 12 ? 'var(--christmas-gold)' : 'var(--text-secondary)' }}
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              ✏️ To update targets, edit the Google Sheet directly. Changes sync automatically.
            </p>
          </div>
        </div>

        {/* Daily Revenue Targets */}
        <div
          className="rounded-xl overflow-hidden mt-6"
          style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              Daily Revenue Targets
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Source: Google Sheet (2026 Targets & Actuals) • Range: B16:N20
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Department</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Jan</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Feb</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Mar</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Apr</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>May</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Jun</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Jul</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Aug</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Sep</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Oct</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Nov</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Dec</th>
                  <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--christmas-gold)' }}>Daily Avg</th>
                </tr>
              </thead>
              <tbody>
                {dailyRevenueTargets.map((row, idx) => (
                  <tr
                    key={row.name}
                    style={{
                      borderBottom: idx < dailyRevenueTargets.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      backgroundColor: row.isTotal ? 'var(--bg-card)' : 'transparent',
                    }}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: row.isTotal ? 'var(--christmas-cream)' : 'var(--text-secondary)' }}>
                      {row.name}
                    </td>
                    {row.values.map((val, i) => (
                      <td
                        key={i}
                        className="text-right px-3 py-3"
                        style={{ color: i === 12 ? 'var(--christmas-gold)' : 'var(--text-secondary)' }}
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>📅 Business Days:</span>
              {businessDaysPerMonth.map((days, i) => (
                <span key={i} className="px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-card)' }}>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}: {days}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly Revenue Targets */}
        <div
          className="rounded-xl overflow-hidden mt-6"
          style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              Weekly Revenue Targets
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Calculated: Daily Target × 5 Business Days
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Department</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Jan</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Feb</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Mar</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Apr</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>May</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Jun</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Jul</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Aug</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Sep</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Oct</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Nov</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Dec</th>
                  <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--christmas-gold)' }}>Weekly Avg</th>
                </tr>
              </thead>
              <tbody>
                {weeklyRevenueTargets.map((row, idx) => (
                  <tr
                    key={row.name}
                    style={{
                      borderBottom: idx < weeklyRevenueTargets.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      backgroundColor: row.isTotal ? 'var(--bg-card)' : 'transparent',
                    }}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: row.isTotal ? 'var(--christmas-cream)' : 'var(--text-secondary)' }}>
                      {row.name}
                    </td>
                    {row.values.map((val, i) => (
                      <td
                        key={i}
                        className="text-right px-3 py-3"
                        style={{ color: i === 12 ? 'var(--christmas-gold)' : 'var(--text-secondary)' }}
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Review Targets */}
        <div
          className="rounded-xl overflow-hidden mt-6"
          style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              Review Targets
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Google Reviews goal pacing • Annual Target: {reviewTargets.annual.toLocaleString()} reviews
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Metric</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Jan</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Feb</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Mar</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Apr</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>May</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Jun</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Jul</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Aug</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Sep</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Oct</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Nov</th>
                  <th className="text-right px-3 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Dec</th>
                  <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--christmas-gold)' }}>Annual</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Monthly Target
                  </td>
                  {reviewTargets.monthly.map((val, i) => (
                    <td key={i} className="text-right px-3 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {val}
                    </td>
                  ))}
                  <td className="text-right px-4 py-3 font-medium" style={{ color: 'var(--christmas-gold)' }}>
                    {reviewTargets.annual}
                  </td>
                </tr>
                <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--christmas-cream)' }}>
                    Daily Target
                  </td>
                  {reviewTargets.daily.map((val, i) => (
                    <td key={i} className="text-right px-3 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {val}
                    </td>
                  ))}
                  <td className="text-right px-4 py-3 font-medium" style={{ color: 'var(--christmas-gold)' }}>
                    {Math.round(reviewTargets.annual / 365 * 10) / 10}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              ⭐ Used for monthly/annual pacing on the Reviews dashboard. Based on 10% of jobs resulting in a review.
            </p>
          </div>
        </div>
        </>
      )}

      {/* KPI Definitions Tab */}
      {activeTab === 'kpis' && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              KPI Definitions
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              All tracked metrics and their data sources
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                  <th className="text-left px-5 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>KPI</th>
                  <th className="text-left px-5 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Department</th>
                  <th className="text-left px-5 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Source</th>
                  <th className="text-left px-5 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Target Type</th>
                  <th className="text-right px-5 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Target</th>
                </tr>
              </thead>
              <tbody>
                {kpiDefinitions.map((kpi, idx) => (
                  <tr
                    key={`${kpi.department}-${kpi.name}`}
                    style={{ borderBottom: idx < kpiDefinitions.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                  >
                    <td className="px-5 py-3 font-medium" style={{ color: 'var(--christmas-cream)' }}>
                      {kpi.name}
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {kpi.department}
                    </td>
                    <td className="px-5 py-3">
                      <SourceBadge source={kpi.source} />
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {kpi.targetType}
                    </td>
                    <td className="px-5 py-3 text-right font-medium" style={{ color: 'var(--christmas-gold)' }}>
                      {kpi.target}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sheet Mappings Tab */}
      {activeTab === 'sheets' && (
        <div className="space-y-6">
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              Google Sheet Configuration
            </h3>
            <div className="grid gap-4">
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Spreadsheet ID
                </div>
                <code className="text-xs" style={{ color: 'var(--christmas-cream)' }}>
                  1w-c6lgPYAGUwtW7biPQoGApIoZcTFgR0usyAGUtWEcw
                </code>
              </div>
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Sheets Used
                </div>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)' }}>
                    2026 Targets & Actuals
                  </span>
                  <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)' }}>
                    Business Days
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                Cell Range Mappings
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                    <th className="text-left px-5 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Data</th>
                    <th className="text-left px-5 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Cell Range</th>
                    <th className="text-left px-5 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(sheetMappings).map(([key, mapping], idx) => (
                    <tr
                      key={key}
                      style={{ borderBottom: idx < Object.keys(sheetMappings).length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                    >
                      <td className="px-5 py-3 font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {key}
                      </td>
                      <td className="px-5 py-3">
                        <code className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--christmas-gold)' }}>
                          {mapping.range}
                        </code>
                      </td>
                      <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>
                        {'departments' in mapping ? mapping.departments.join(', ') : mapping.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Data Sync Tab */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          {/* Trade Data Sync */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                    Trade Revenue Data
                  </h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Historical trade metrics synced from ServiceTitan to Supabase for faster dashboard loading
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tradeSyncedDates.length > 0 ? '#4ADE80' : '#ef4444' }}></div>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {tradeSyncedDates.length} days synced
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5">
              {tradeSyncResult && (
                <div
                  className="p-3 rounded-lg mb-4 text-sm"
                  style={{
                    backgroundColor: tradeSyncResult.error
                      ? 'rgba(220, 38, 38, 0.1)'
                      : 'rgba(74, 222, 128, 0.1)',
                    border: `1px solid ${tradeSyncResult.error ? 'rgba(220, 38, 38, 0.3)' : 'rgba(74, 222, 128, 0.3)'}`,
                    color: tradeSyncResult.error ? '#dc2626' : '#4ADE80',
                  }}
                >
                  {tradeSyncResult.message || tradeSyncResult.error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div
                  className="rounded-lg p-4"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="text-sm font-medium mb-2" style={{ color: 'var(--christmas-cream)' }}>
                    Sync Yesterday
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    Sync the previous day&apos;s trade data. Run this daily or set up a cron job.
                  </p>
                  <button
                    onClick={handleTradeSyncYesterday}
                    disabled={isSyncingTrades}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: 'var(--christmas-green)',
                      color: 'var(--christmas-cream)',
                      opacity: isSyncingTrades ? 0.7 : 1,
                    }}
                  >
                    <svg
                      className={`w-4 h-4 ${isSyncingTrades ? 'animate-spin' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    {isSyncingTrades ? 'Syncing...' : 'Sync Yesterday'}
                  </button>
                </div>

                <div
                  className="rounded-lg p-4"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="text-sm font-medium mb-2" style={{ color: 'var(--christmas-cream)' }}>
                    Backfill Historical Data
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    Sync multiple days of historical data. Use for initial setup.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTradeSyncBackfill(30)}
                      disabled={isSyncingTrades}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: 'var(--christmas-gold)',
                        color: 'var(--bg-primary)',
                        opacity: isSyncingTrades ? 0.7 : 1,
                      }}
                    >
                      30 Days
                    </button>
                    <button
                      onClick={() => handleTradeSyncBackfill(90)}
                      disabled={isSyncingTrades}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: 'var(--christmas-gold)',
                        color: 'var(--bg-primary)',
                        opacity: isSyncingTrades ? 0.7 : 1,
                      }}
                    >
                      90 Days
                    </button>
                    <button
                      onClick={() => handleTradeSyncBackfill(365)}
                      disabled={isSyncingTrades}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: '#ef4444',
                        color: 'white',
                        opacity: isSyncingTrades ? 0.7 : 1,
                      }}
                    >
                      1 Year
                    </button>
                  </div>
                </div>
              </div>

              {/* Synced dates preview */}
              {tradeSyncedDates.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Recent Synced Dates
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tradeSyncedDates.slice(0, 14).map((date) => (
                      <span
                        key={date}
                        className="text-xs px-2 py-1 rounded"
                        style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}
                      >
                        {date}
                      </span>
                    ))}
                    {tradeSyncedDates.length > 14 && (
                      <span
                        className="text-xs px-2 py-1 rounded"
                        style={{ backgroundColor: 'var(--bg-card)', color: 'var(--christmas-gold)' }}
                      >
                        +{tradeSyncedDates.length - 14} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                💡 Trade data is stored in the <code style={{ color: 'var(--christmas-gold)' }}>trade_daily_snapshots</code> table.
                The dashboard reads historical data from here instead of calling ServiceTitan for each period.
              </p>
            </div>
          </div>

          {/* Architecture explanation */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              Data Architecture
            </h3>
            <div className="space-y-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex items-start gap-3">
                <span className="text-lg">📊</span>
                <div>
                  <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>Historical Data (Supabase)</div>
                  <p className="mt-1">MTD, QTD, YTD metrics are read from stored snapshots. This reduces API calls from 20+ to 1-2.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">⚡</span>
                <div>
                  <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>Live Data (ServiceTitan)</div>
                  <p className="mt-1">Only &quot;today&quot; metrics are fetched live from ServiceTitan API to show real-time numbers.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">🔄</span>
                <div>
                  <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>Daily Sync</div>
                  <p className="mt-1">Run &quot;Sync Yesterday&quot; daily (or set up cron) to keep historical data fresh. Revenue adjustments are captured when they&apos;re posted.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
