'use client';

import { useState, useMemo } from 'react';

export interface LocationData {
  locationId: string;
  locationName: string;
  totalViews: number;
  viewsMaps: number;
  viewsSearch: number;
  websiteClicks: number;
  phoneCalls: number;
  directionRequests: number;
  // YoY percentage changes (null if no previous data)
  callsYoY?: number | null;
  viewsYoY?: number | null;
  clicksYoY?: number | null;
  directionsYoY?: number | null;
  // YTD totals
  ytdCalls?: number;
  ytdViews?: number;
  ytdClicks?: number;
  ytdDirections?: number;
}

type SortField = 'locationName' | 'phoneCalls' | 'totalViews' | 'websiteClicks' | 'directionRequests';
type SortDirection = 'asc' | 'desc';

interface LocationSummaryTableProps {
  data: LocationData[];
  isLoading?: boolean;
}

function formatValue(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatYoY(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(0)}%`;
}

function YoYBadge({ value }: { value: number | null | undefined }) {
  const formatted = formatYoY(value);
  if (!formatted) return null;

  const isPositive = value !== null && value !== undefined && value >= 0;

  return (
    <span
      className="text-[10px] font-medium ml-1"
      style={{
        color: isPositive ? '#5d8a66' : '#c97878',
      }}
    >
      {formatted}
    </span>
  );
}

export function LocationSummaryTable({
  data,
  isLoading = false,
}: LocationSummaryTableProps) {
  const [sortField, setSortField] = useState<SortField>('phoneCalls');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [data, sortField, sortDirection]);

  const totals = useMemo(() => {
    return data.reduce(
      (acc, loc) => ({
        views: acc.views + loc.totalViews,
        calls: acc.calls + loc.phoneCalls,
        clicks: acc.clicks + loc.websiteClicks,
        directions: acc.directions + loc.directionRequests,
        ytdCalls: acc.ytdCalls + (loc.ytdCalls || 0),
      }),
      { views: 0, calls: 0, clicks: 0, directions: 0, ytdCalls: 0 }
    );
  }, [data]);

  // Check if we have YoY data available
  const hasYoYData = data.some(loc => loc.callsYoY !== null && loc.callsYoY !== undefined);
  const hasYtdData = data.some(loc => loc.ytdCalls !== undefined && loc.ytdCalls > 0);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-3 h-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {sortDirection === 'desc' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        )}
      </svg>
    );
  };

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-5 max-w-4xl"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Location Summary
        </h2>
        <div className="h-48 flex items-center justify-center">
          <div className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading location data...
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className="rounded-xl p-5 max-w-4xl"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Location Summary
        </h2>
        <div className="h-48 flex items-center justify-center flex-col gap-2">
          <svg className="w-10 h-10 opacity-50" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No location data available</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-5 max-w-4xl"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
        Location Summary
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <th className="text-left py-2.5 px-2">
                <button
                  onClick={() => handleSort('locationName')}
                  className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Location
                  <SortIcon field="locationName" />
                </button>
              </th>
              <th className="text-right py-2.5 px-2">
                <button
                  onClick={() => handleSort('phoneCalls')}
                  className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity ml-auto"
                  style={{ color: sortField === 'phoneCalls' ? '#B8956B' : 'var(--text-muted)' }}
                >
                  Calls
                  {hasYoYData && <span className="text-[9px] opacity-60 ml-0.5">YoY</span>}
                  <SortIcon field="phoneCalls" />
                </button>
              </th>
              <th className="text-right py-2.5 px-2">
                <button
                  onClick={() => handleSort('totalViews')}
                  className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity ml-auto"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Views
                  {hasYoYData && <span className="text-[9px] opacity-60 ml-0.5">YoY</span>}
                  <SortIcon field="totalViews" />
                </button>
              </th>
              <th className="text-right py-2.5 px-2">
                <button
                  onClick={() => handleSort('websiteClicks')}
                  className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity ml-auto"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Clicks
                  {hasYoYData && <span className="text-[9px] opacity-60 ml-0.5">YoY</span>}
                  <SortIcon field="websiteClicks" />
                </button>
              </th>
              <th className="text-right py-2.5 px-2">
                <button
                  onClick={() => handleSort('directionRequests')}
                  className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity ml-auto"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Dirs
                  {hasYoYData && <span className="text-[9px] opacity-60 ml-0.5">YoY</span>}
                  <SortIcon field="directionRequests" />
                </button>
              </th>
              {hasYtdData && (
                <th className="text-right py-2.5 px-2">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    YTD Calls
                  </span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((loc, idx) => (
              <tr
                key={loc.locationId}
                className="transition-colors hover:bg-white/5"
                style={{
                  borderBottom: idx < sortedData.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                }}
              >
                <td className="py-2.5 px-2">
                  <span className="text-sm font-medium capitalize" style={{ color: 'var(--christmas-cream)' }}>
                    {loc.locationName}
                  </span>
                </td>
                <td className="py-2.5 px-2 text-right whitespace-nowrap">
                  <span className="text-sm font-semibold tabular-nums" style={{ color: '#B8956B' }}>
                    {formatValue(loc.phoneCalls)}
                  </span>
                  {hasYoYData && <YoYBadge value={loc.callsYoY} />}
                </td>
                <td className="py-2.5 px-2 text-right whitespace-nowrap">
                  <span className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {formatValue(loc.totalViews)}
                  </span>
                  {hasYoYData && <YoYBadge value={loc.viewsYoY} />}
                </td>
                <td className="py-2.5 px-2 text-right whitespace-nowrap">
                  <span className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {formatValue(loc.websiteClicks)}
                  </span>
                  {hasYoYData && <YoYBadge value={loc.clicksYoY} />}
                </td>
                <td className="py-2.5 px-2 text-right whitespace-nowrap">
                  <span className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {formatValue(loc.directionRequests)}
                  </span>
                  {hasYoYData && <YoYBadge value={loc.directionsYoY} />}
                </td>
                {hasYtdData && (
                  <td className="py-2.5 px-2 text-right">
                    <span className="text-sm tabular-nums font-medium" style={{ color: '#6B9DB8' }}>
                      {formatValue(loc.ytdCalls || 0)}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border-subtle)' }}>
              <td className="py-2.5 px-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                  Total
                </span>
              </td>
              <td className="py-2.5 px-2 text-right">
                <span className="text-sm font-bold tabular-nums" style={{ color: '#B8956B' }}>
                  {formatValue(totals.calls)}
                </span>
              </td>
              <td className="py-2.5 px-2 text-right">
                <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {formatValue(totals.views)}
                </span>
              </td>
              <td className="py-2.5 px-2 text-right">
                <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {formatValue(totals.clicks)}
                </span>
              </td>
              <td className="py-2.5 px-2 text-right">
                <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {formatValue(totals.directions)}
                </span>
              </td>
              {hasYtdData && (
                <td className="py-2.5 px-2 text-right">
                  <span className="text-sm font-bold tabular-nums" style={{ color: '#6B9DB8' }}>
                    {formatValue(totals.ytdCalls)}
                  </span>
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      <div
        className="mt-3 pt-2 text-[11px]"
        style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
      >
        {data.length} locations &bull; Click headers to sort
      </div>
    </div>
  );
}

export default LocationSummaryTable;
