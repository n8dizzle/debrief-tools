'use client';

import { Calendar, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { KPICards } from '@/components/dashboard/KPICards';
import { LeadPools } from '@/components/dashboard/LeadPools';
import { RoundRobinQueue } from '@/components/dashboard/RoundRobinQueue';
import { useDashboardStore } from '@/store/dashboardStore';
import { DateRangePreset } from '@/types';

export function DashboardView() {
  const { dateRange, setDateRange, fetchAdvisors } = useDashboardStore();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleDatePresetChange = async (preset: DateRangePreset) => {
    setDateRange(preset);
    // When date range changes, trigger a sync to get updated data
    await handleSync(preset);
  };

  const handleSync = async (preset?: DateRangePreset) => {
    setIsSyncing(true);
    try {
      const range = preset ? useDashboardStore.getState().dateRange : dateRange;
      // After preset is set, get the updated dateRange
      const updatedRange = preset
        ? useDashboardStore.getState().dateRange
        : range;

      const response = await fetch('/api/servicetitan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'syncSales',
          startDate: updatedRange.startDate.toISOString(),
          endDate: updatedRange.endDate.toISOString(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchAdvisors();
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground">Overview of sales performance</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Period:</span>
          </div>
          <select
            value={dateRange.preset}
            onChange={(e) => handleDatePresetChange(e.target.value as DateRangePreset)}
            className="px-3 py-2 rounded-lg bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          >
            <optgroup label="Days">
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
            </optgroup>
            <optgroup label="Weeks">
              <option value="thisWeek">This Week</option>
              <option value="weekToDate">Week to Date</option>
              <option value="last7">Last 7 Days</option>
              <option value="last14">Last 14 Days</option>
            </optgroup>
            <optgroup label="Months">
              <option value="last30">Last 30 Days</option>
              <option value="mtd">Month to Date</option>
              <option value="lastMonth">Last Month</option>
            </optgroup>
            <optgroup label="Quarters">
              <option value="last90">Last 90 Days</option>
              <option value="thisQuarter">This Quarter</option>
              <option value="lastQuarter">Last Quarter</option>
              <option value="quarterToDate">Quarter to Date</option>
            </optgroup>
            <optgroup label="Years">
              <option value="ytd">Year to Date</option>
              <option value="last365">Last 365 Days</option>
              <option value="lastYear">Last Year</option>
            </optgroup>
          </select>
          <button
            onClick={() => handleSync()}
            disabled={isSyncing}
            className="px-3 py-2 rounded-lg bg-sage hover:bg-sage/90 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      </div>
      <KPICards />
      <LeadPools />
      <RoundRobinQueue />
    </div>
  );
}
