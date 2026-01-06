'use client';

import { useState, useEffect, useCallback } from 'react';
import { HuddleDashboardResponse } from '@/lib/supabase';
import { getTodayDateString, getYesterdayDateString, formatDateForDisplay } from '@/lib/huddle-utils';
import DepartmentSection from './DepartmentSection';

interface HuddleDashboardProps {
  initialData?: HuddleDashboardResponse;
  canEditNotes?: boolean;
  defaultDate?: string;
  showHeader?: boolean;
}

export default function HuddleDashboard({
  initialData,
  canEditNotes = true,
  defaultDate,
  showHeader = true,
}: HuddleDashboardProps) {
  const [data, setData] = useState<HuddleDashboardResponse | null>(initialData || null);
  const [selectedDate, setSelectedDate] = useState(defaultDate || getYesterdayDateString());
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/huddle?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Trigger data sync from ServiceTitan
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/huddle/snapshots/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      });
      if (!response.ok) throw new Error('Sync failed');
      const result = await response.json();
      setLastSync(new Date().toLocaleTimeString());
      // Refresh data after sync
      await fetchData();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle note changes (update local state)
  const handleNoteChange = (kpiId: string, note: string) => {
    if (!data) return;
    setData({
      ...data,
      departments: data.departments.map((dept) => ({
        ...dept,
        kpis: dept.kpis.map((kpi) =>
          kpi.id === kpiId ? { ...kpi, note } : kpi
        ),
      })),
    });
  };

  // Date presets
  const datePresets = [
    { label: 'Yesterday', value: getYesterdayDateString() },
    { label: 'Today', value: getTodayDateString() },
  ];

  return (
    <div>
      {/* Header - conditionally shown */}
      {showHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: 'var(--christmas-cream)' }}
            >
              Daily Huddle
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              {formatDateForDisplay(selectedDate)}
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {/* Date selector */}
          <div className="flex items-center gap-2">
            {datePresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setSelectedDate(preset.value)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  selectedDate === preset.value ? 'font-medium' : ''
                }`}
                style={{
                  backgroundColor:
                    selectedDate === preset.value
                      ? 'var(--christmas-green)'
                      : 'var(--bg-card)',
                  color:
                    selectedDate === preset.value
                      ? 'var(--christmas-cream)'
                      : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {preset.label}
              </button>
            ))}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg"
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
              }}
            />
          </div>

          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--christmas-gold)',
              color: 'var(--bg-primary)',
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
            {isSyncing ? 'Syncing...' : 'Sync Data'}
          </button>
        </div>
      </div>

      {/* Last sync indicator */}
      {lastSync && (
        <p
          className="text-xs mb-4"
          style={{ color: 'var(--text-muted)' }}
        >
          Last synced: {lastSync}
        </p>
      )}

      {/* Loading state */}
      {isLoading && !data && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 animate-spin"
              style={{ color: 'var(--christmas-green)' }}
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
            <span style={{ color: 'var(--text-secondary)' }}>Loading...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          className="p-4 rounded-lg mb-4"
          style={{
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
          }}
        >
          <p style={{ color: '#dc2626' }}>{error}</p>
        </div>
      )}

      {/* Department sections */}
      {data && (
        <div>
          {data.departments.map((dept) => (
            <DepartmentSection
              key={dept.id}
              department={dept}
              date={selectedDate}
              defaultExpanded={true}
              canEditNotes={canEditNotes}
              onNoteChange={handleNoteChange}
            />
          ))}
        </div>
      )}

      {/* Last updated */}
      {data && (
        <p
          className="text-xs text-center mt-6"
          style={{ color: 'var(--text-muted)' }}
        >
          Data as of {new Date(data.last_updated).toLocaleString()}
        </p>
      )}
    </div>
  );
}
