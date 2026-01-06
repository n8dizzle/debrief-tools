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
  const [activeTab, setActiveTab] = useState<'kpis' | 'targets' | 'sheets'>('targets');

  const [syncResult, setSyncResult] = useState<{ message?: string; error?: string } | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch('/api/dash/targets/sync', { method: 'POST' });
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
      const response = await fetch('/api/dash/targets/seed', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setLastSync(new Date().toLocaleString());
        setSyncResult({ message: data.message });
      } else {
        setSyncResult({ error: data.error || 'Seed failed' });
      }
    } catch (err) {
      setSyncResult({ error: 'Failed to seed data' });
    } finally {
      setIsSyncing(false);
    }
  };

  const tabs = [
    { id: 'targets', label: 'Revenue Targets' },
    { id: 'kpis', label: 'KPI Definitions' },
    { id: 'sheets', label: 'Sheet Mappings' },
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
    </div>
  );
}
