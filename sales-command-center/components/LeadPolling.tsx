'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, BellOff, RefreshCw } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

interface PollResult {
  success: boolean;
  message?: string;
  newLeads?: { marketed: number; tgl: number };
  statusSync?: { updated: number };
  error?: string;
}

export function LeadPolling() {
  const { fetchLeads, fetchAdvisors } = useDashboardStore();

  const [isEnabled, setIsEnabled] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<Date | null>(null);
  const [lastResult, setLastResult] = useState<PollResult | null>(null);
  const [nextPollIn, setNextPollIn] = useState<number | null>(null); // seconds

  // Use a ref so the interval callback always sees the latest value without re-creating
  const isPollingRef = useRef(false);

  const pollForLeads = useCallback(async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    setIsPolling(true);

    try {
      const response = await fetch('/api/leads/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data: PollResult = await response.json();
      setLastResult(data);
      setLastPollTime(new Date());

      if (data.success) {
        // Refresh store so UI reflects any new leads / status changes
        await Promise.all([fetchLeads(), fetchAdvisors()]);

        // Browser notification for new leads
        const newCount = (data.newLeads?.marketed ?? 0) + (data.newLeads?.tgl ?? 0);
        if (newCount > 0 && Notification.permission === 'granted') {
          new Notification('New Lead Assigned', {
            body: `${newCount} new lead(s) imported from Service Titan`,
            icon: '/favicon.ico',
          });
        }
      }
    } catch (error: any) {
      setLastResult({ success: false, error: error.message });
    } finally {
      isPollingRef.current = false;
      setIsPolling(false);
      setNextPollIn(POLL_INTERVAL_MS / 1000);
    }
  }, [fetchLeads, fetchAdvisors]);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!isEnabled || nextPollIn === null) return;
    if (nextPollIn <= 0) return;

    const timer = setInterval(() => {
      setNextPollIn((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isEnabled, nextPollIn]);

  // Auto-poll interval
  useEffect(() => {
    if (!isEnabled) {
      setNextPollIn(null);
      return;
    }

    // Poll immediately on enable
    pollForLeads();

    const interval = setInterval(pollForLeads, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isEnabled]); // intentionally omit pollForLeads — stable via ref

  const formatCountdown = () => {
    if (nextPollIn === null || !isEnabled) return null;
    const m = Math.floor(nextPollIn / 60);
    const s = nextPollIn % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const newCount = (lastResult?.newLeads?.marketed ?? 0) + (lastResult?.newLeads?.tgl ?? 0);
  const synced = lastResult?.statusSync?.updated ?? 0;

  return (
    <div className="flex items-center gap-2">
      {/* Status indicator */}
      <div className="flex items-center gap-1.5 text-sm">
        {isPolling ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-sage" />
        ) : isEnabled ? (
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-gray-400" />
        )}

        <span className="text-muted-foreground hidden md:inline text-xs">
          {isPolling
            ? 'Syncing ST...'
            : isEnabled
            ? `Next sync: ${formatCountdown() ?? '...'}`
            : 'Paused'}
        </span>
      </div>

      {/* Badge: new leads */}
      {newCount > 0 && (
        <span className="text-xs bg-sage/20 text-sage px-2 py-0.5 rounded-full">
          +{newCount} new
        </span>
      )}

      {/* Badge: status updates */}
      {synced > 0 && (
        <span className="text-xs bg-forest/20 text-forest px-2 py-0.5 rounded-full">
          {synced} updated
        </span>
      )}

      {/* Error badge */}
      {lastResult && !lastResult.success && (
        <span
          className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full"
          title={lastResult.error}
        >
          Sync error
        </span>
      )}

      {/* Toggle auto-poll */}
      <button
        onClick={() => setIsEnabled(!isEnabled)}
        className={`p-1.5 rounded-lg transition-colors ${
          isEnabled
            ? 'bg-sage/10 text-sage hover:bg-sage/20'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        }`}
        title={isEnabled ? 'Pause auto-sync' : 'Resume auto-sync'}
      >
        {isEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
      </button>

      {/* Manual sync */}
      <button
        onClick={pollForLeads}
        disabled={isPolling}
        className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 transition-colors"
        title="Sync now"
      >
        <RefreshCw className={`w-4 h-4 ${isPolling ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
