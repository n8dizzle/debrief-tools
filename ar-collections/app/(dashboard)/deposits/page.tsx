'use client';

import { useEffect, useState } from 'react';
import { useARPermissions } from '@/hooks/useARPermissions';
import QuickBooksStatus from '@/components/deposits/QuickBooksStatus';
import DepositSummaryCards from '@/components/deposits/DepositSummaryCards';
import PaymentReconciliationTable, { ReconciliationRecord } from '@/components/deposits/PaymentReconciliationTable';
import MatchPaymentModal from '@/components/deposits/MatchPaymentModal';

type DepositTab = 'needs_tracking' | 'undeposited' | 'matched' | 'discrepancy';

interface DepositSummary {
  totalUndeposited: number;
  undepositedCount: number;
  needsTracking: number;
  needsTrackingCount: number;
  pendingMatch: number;
  pendingMatchCount: number;
  matchedToday: number;
  matchedTodayCount: number;
  byType: {
    cash: number;
    check: number;
    card: number;
    other: number;
  };
}

interface QBStatus {
  configured: boolean;
  connected: boolean;
  companyName: string | null;
  lastSync?: {
    completedAt: string;
    recordsFetched: number;
    matchesFound: number;
  } | null;
}

export default function DepositsPage() {
  const [activeTab, setActiveTab] = useState<DepositTab>('needs_tracking');
  const [records, setRecords] = useState<ReconciliationRecord[]>([]);
  const [summary, setSummary] = useState<DepositSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [qbStatus, setQbStatus] = useState<QBStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal state
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ReconciliationRecord | null>(null);

  const { isManager, isOwner } = useARPermissions();

  useEffect(() => {
    fetchQBStatus();
    fetchDeposits();
  }, [activeTab]);

  async function fetchQBStatus() {
    try {
      const response = await fetch('/api/quickbooks/status', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setQbStatus(data);
      }
    } catch (err) {
      console.error('Error fetching QB status:', err);
    }
  }

  async function fetchDeposits() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', activeTab);

      const response = await fetch(`/api/deposits?${params.toString()}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setRecords(data.records || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error('Error fetching deposits:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    try {
      const response = await fetch('/api/quickbooks/auth', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Redirect to QuickBooks authorization
        window.location.href = data.authUrl;
      } else {
        const error = await response.json();
        setSyncMessage({ type: 'error', text: error.error || 'Failed to connect' });
      }
    } catch (err) {
      console.error('Error connecting to QuickBooks:', err);
      setSyncMessage({ type: 'error', text: 'Failed to connect to QuickBooks' });
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const response = await fetch('/api/quickbooks/sync', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();
      console.log('[Deposits Sync] Full response:', data);

      if (response.ok && data.success) {
        const stMsg = data.stPaymentsFetched ? `, ${data.stPaymentsFetched} ST payments` : '';
        const createdMsg = data.stPaymentsCreated ? ` (${data.stPaymentsCreated} new)` : '';
        setSyncMessage({
          type: 'success',
          text: `Synced ${data.recordsFetched} QB payments${stMsg}${createdMsg}, found ${data.matchesFound} matches`,
        });
        fetchQBStatus();
        fetchDeposits();
      } else {
        setSyncMessage({ type: 'error', text: data.errors || data.error || 'Sync failed' });
      }
    } catch (err) {
      console.error('Error syncing:', err);
      setSyncMessage({ type: 'error', text: 'Sync failed' });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 15000);
    }
  }

  function handleManualMatch(recordId: string) {
    const record = records.find((r) => r.id === recordId);
    if (record) {
      setSelectedRecord(record);
      setMatchModalOpen(true);
    }
  }

  async function handleMatch(recordId: string, invoiceId: string) {
    const response = await fetch('/api/deposits/match', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reconciliationId: recordId, invoiceId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to match');
    }

    // Refresh data
    fetchDeposits();
  }

  async function handleMarkDiscrepancy(recordId: string) {
    if (!confirm('Mark this payment as a discrepancy? This indicates the payment has an issue that needs investigation.')) {
      return;
    }

    try {
      const response = await fetch('/api/deposits/match', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reconciliationId: recordId, action: 'discrepancy' }),
      });

      if (response.ok) {
        fetchDeposits();
      }
    } catch (err) {
      console.error('Error marking discrepancy:', err);
    }
  }

  const tabs: { id: DepositTab; label: string; count?: number; highlight?: boolean }[] = [
    { id: 'needs_tracking', label: 'Needs Tracking', count: summary?.needsTrackingCount, highlight: true },
    { id: 'undeposited', label: 'In QB Undeposited', count: summary?.undepositedCount },
    { id: 'matched', label: 'Matched' },
    { id: 'discrepancy', label: 'Discrepancies' },
  ];

  // Check for URL params (e.g., after OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qb = params.get('qb');
    const error = params.get('error');

    if (qb === 'connected') {
      setSyncMessage({ type: 'success', text: 'Successfully connected to QuickBooks!' });
      fetchQBStatus();
      // Clear URL params
      window.history.replaceState({}, '', '/deposits');
    } else if (error) {
      setSyncMessage({ type: 'error', text: `Connection error: ${error}` });
      window.history.replaceState({}, '', '/deposits');
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Payment Deposits
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Track payments from collection through bank deposit
          </p>
        </div>
        {qbStatus && (
          <QuickBooksStatus
            connected={qbStatus.connected}
            companyName={qbStatus.companyName}
            lastSync={qbStatus.lastSync}
            onConnect={handleConnect}
            onSync={handleSync}
            syncing={syncing}
          />
        )}
      </div>

      {/* Status Messages */}
      {syncMessage && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{
            backgroundColor: syncMessage.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: syncMessage.type === 'success' ? 'var(--christmas-green)' : 'var(--status-error)',
          }}
        >
          {syncMessage.text}
        </div>
      )}

      {/* Not Connected State - but still show ST payments if available */}
      {qbStatus && !qbStatus.connected && (
        <>
          <div
            className="p-4 rounded-lg"
            style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)' }}
          >
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: '#eab308' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold" style={{ color: '#eab308' }}>
                  QuickBooks Not Connected
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  ServiceTitan payments are synced below. Connect QuickBooks to see which payments have been deposited.
                </p>
                {(isManager || isOwner) && (
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={handleConnect} className="btn btn-secondary btn-sm">
                      Connect QuickBooks
                    </button>
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      className="btn btn-primary btn-sm"
                    >
                      {syncing ? 'Syncing...' : 'Sync ST Payments'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <DepositSummaryCards summary={summary} loading={loading} />

          {/* Tab Navigation - limited without QB */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <button
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{
                backgroundColor: 'var(--status-error)',
                color: 'white',
              }}
            >
              Needs Tracking
              {summary?.needsTrackingCount !== undefined && summary.needsTrackingCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  {summary.needsTrackingCount}
                </span>
              )}
            </button>
          </div>

          {/* Data Table */}
          <div className="card p-0 overflow-hidden">
            <PaymentReconciliationTable
              records={records}
              loading={loading}
              onManualMatch={handleManualMatch}
              onMarkDiscrepancy={handleMarkDiscrepancy}
            />
          </div>
        </>
      )}

      {/* Connected State */}
      {qbStatus?.connected && (
        <>
          {/* Summary Cards */}
          <DepositSummaryCards summary={summary} loading={loading} />

          {/* Tab Navigation */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const hasHighlightItems = tab.highlight && tab.count && tab.count > 0;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                  style={{
                    backgroundColor: isActive
                      ? (hasHighlightItems ? 'var(--status-error)' : 'var(--christmas-green)')
                      : 'transparent',
                    color: isActive ? 'white' : (hasHighlightItems ? 'var(--status-error)' : 'var(--text-muted)'),
                  }}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-bold"
                      style={{
                        backgroundColor: isActive
                          ? 'rgba(255,255,255,0.2)'
                          : (hasHighlightItems ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-tertiary)'),
                        color: isActive ? 'white' : (hasHighlightItems ? 'var(--status-error)' : 'inherit'),
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Data Table */}
          <div className="card p-0 overflow-hidden">
            <PaymentReconciliationTable
              records={records}
              loading={loading}
              onManualMatch={handleManualMatch}
              onMarkDiscrepancy={handleMarkDiscrepancy}
            />
          </div>
        </>
      )}

      {/* Match Modal */}
      <MatchPaymentModal
        isOpen={matchModalOpen}
        onClose={() => {
          setMatchModalOpen(false);
          setSelectedRecord(null);
        }}
        record={selectedRecord}
        onMatch={handleMatch}
      />
    </div>
  );
}
