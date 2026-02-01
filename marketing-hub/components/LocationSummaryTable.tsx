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
  // ServiceTitan metrics (null if no campaign name configured)
  stCallsBooked?: number | null;
  stCallsTotal?: number | null;
  stRevenue?: number | null;
  stAvgTicket?: number | null;
  stJobCount?: number | null;
  hasSTCampaign?: boolean;
}

type SortField = 'locationName' | 'phoneCalls' | 'totalViews' | 'websiteClicks' | 'directionRequests' | 'stCallsBooked' | 'stRevenue';
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

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatYoY(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(0)}%`;
}

function YoYCell({ value }: { value: number | null | undefined }) {
  const formatted = formatYoY(value);
  const isPositive = value !== null && value !== undefined && value >= 0;
  const hasValue = value !== null && value !== undefined;

  return (
    <span
      className="text-sm tabular-nums"
      style={{
        color: !hasValue ? 'var(--text-muted)' : isPositive ? '#5d8a66' : '#c97878',
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
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle null/undefined ST values (treat as 0 for sorting)
      if (aVal === null || aVal === undefined) aVal = 0;
      if (bVal === null || bVal === undefined) bVal = 0;

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
        stCallsBooked: acc.stCallsBooked + (loc.stCallsBooked || 0),
        stRevenue: acc.stRevenue + (loc.stRevenue || 0),
        stJobCount: acc.stJobCount + (loc.stJobCount || 0),
      }),
      { views: 0, calls: 0, clicks: 0, directions: 0, ytdCalls: 0, stCallsBooked: 0, stRevenue: 0, stJobCount: 0 }
    );
  }, [data]);

  // Check if we have YoY data available
  const hasYoYData = data.some(loc => loc.callsYoY !== null && loc.callsYoY !== undefined);
  const hasYtdData = data.some(loc => loc.ytdCalls !== undefined && loc.ytdCalls > 0);
  // Check if any location has ST data (campaign name configured)
  const hasSTData = data.some(loc => loc.hasSTCampaign);

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
        <svg className="w-3.5 h-3.5 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        className="rounded-xl p-6"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <h2 className="text-xl font-semibold mb-5" style={{ color: 'var(--christmas-cream)' }}>
          Location Summary
        </h2>
        <div className="h-48 flex items-center justify-center">
          <div className="animate-pulse text-base" style={{ color: 'var(--text-muted)' }}>
            Loading location data...
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <h2 className="text-xl font-semibold mb-5" style={{ color: 'var(--christmas-cream)' }}>
          Location Summary
        </h2>
        <div className="h-48 flex items-center justify-center flex-col gap-2">
          <svg className="w-12 h-12 opacity-50" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-base" style={{ color: 'var(--text-muted)' }}>No location data available</p>
        </div>
      </div>
    );
  }

  // Calculate average ticket from totals
  const totalAvgTicket = totals.stJobCount > 0 ? totals.stRevenue / totals.stJobCount : 0;

  return (
    <div
      className="rounded-xl p-6"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <h2 className="text-xl font-semibold mb-5" style={{ color: 'var(--christmas-cream)' }}>
        Location Summary
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {/* Location */}
              <th className="text-left py-3 px-3">
                <button
                  onClick={() => handleSort('locationName')}
                  className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Location
                  <SortIcon field="locationName" />
                </button>
              </th>
              {/* Calls */}
              <th className="text-right py-3 px-3">
                <button
                  onClick={() => handleSort('phoneCalls')}
                  className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity ml-auto"
                  style={{ color: sortField === 'phoneCalls' ? '#B8956B' : 'var(--text-muted)' }}
                >
                  Calls
                  <SortIcon field="phoneCalls" />
                </button>
              </th>
              {hasYoYData && (
                <th className="text-right py-3 px-2 w-16">
                  <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    YoY
                  </span>
                </th>
              )}
              {/* Views */}
              <th className="text-right py-3 px-3">
                <button
                  onClick={() => handleSort('totalViews')}
                  className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity ml-auto"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Views
                  <SortIcon field="totalViews" />
                </button>
              </th>
              {hasYoYData && (
                <th className="text-right py-3 px-2 w-16">
                  <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    YoY
                  </span>
                </th>
              )}
              {/* Clicks */}
              <th className="text-right py-3 px-3">
                <button
                  onClick={() => handleSort('websiteClicks')}
                  className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity ml-auto"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Clicks
                  <SortIcon field="websiteClicks" />
                </button>
              </th>
              {hasYoYData && (
                <th className="text-right py-3 px-2 w-16">
                  <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    YoY
                  </span>
                </th>
              )}
              {/* Directions */}
              <th className="text-right py-3 px-3">
                <button
                  onClick={() => handleSort('directionRequests')}
                  className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity ml-auto"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Dirs
                  <SortIcon field="directionRequests" />
                </button>
              </th>
              {hasYoYData && (
                <th className="text-right py-3 px-2 w-16">
                  <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    YoY
                  </span>
                </th>
              )}
              {/* YTD Calls */}
              {hasYtdData && (
                <th className="text-right py-3 px-3">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    YTD Calls
                  </span>
                </th>
              )}
              {/* ServiceTitan columns - separated by visual divider */}
              {hasSTData && (
                <>
                  <th className="py-3 px-1 w-px" style={{ borderLeft: '2px solid var(--border-subtle)' }}></th>
                  <th className="text-right py-3 px-3">
                    <button
                      onClick={() => handleSort('stCallsBooked')}
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity ml-auto"
                      style={{ color: sortField === 'stCallsBooked' ? '#5D8A66' : 'var(--text-muted)' }}
                      title="ServiceTitan booked calls from tracking number"
                    >
                      ST Booked
                      <SortIcon field="stCallsBooked" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-3">
                    <button
                      onClick={() => handleSort('stRevenue')}
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity ml-auto"
                      style={{ color: sortField === 'stRevenue' ? '#5D8A66' : 'var(--text-muted)' }}
                      title="Revenue from completed jobs linked to booked calls"
                    >
                      Revenue
                      <SortIcon field="stRevenue" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-3">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }} title="Average revenue per completed job">
                      Avg Ticket
                    </span>
                  </th>
                </>
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
                {/* Location Name */}
                <td className="py-3.5 px-3">
                  <span className="text-base font-medium capitalize" style={{ color: 'var(--christmas-cream)' }}>
                    {loc.locationName}
                  </span>
                </td>
                {/* Calls */}
                <td className="py-3.5 px-3 text-right">
                  <span className="text-base font-semibold tabular-nums" style={{ color: '#B8956B' }}>
                    {formatValue(loc.phoneCalls)}
                  </span>
                </td>
                {hasYoYData && (
                  <td className="py-3.5 px-2 text-right">
                    <YoYCell value={loc.callsYoY} />
                  </td>
                )}
                {/* Views */}
                <td className="py-3.5 px-3 text-right">
                  <span className="text-base tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {formatValue(loc.totalViews)}
                  </span>
                </td>
                {hasYoYData && (
                  <td className="py-3.5 px-2 text-right">
                    <YoYCell value={loc.viewsYoY} />
                  </td>
                )}
                {/* Clicks */}
                <td className="py-3.5 px-3 text-right">
                  <span className="text-base tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {formatValue(loc.websiteClicks)}
                  </span>
                </td>
                {hasYoYData && (
                  <td className="py-3.5 px-2 text-right">
                    <YoYCell value={loc.clicksYoY} />
                  </td>
                )}
                {/* Directions */}
                <td className="py-3.5 px-3 text-right">
                  <span className="text-base tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {formatValue(loc.directionRequests)}
                  </span>
                </td>
                {hasYoYData && (
                  <td className="py-3.5 px-2 text-right">
                    <YoYCell value={loc.directionsYoY} />
                  </td>
                )}
                {/* YTD Calls */}
                {hasYtdData && (
                  <td className="py-3.5 px-3 text-right">
                    <span className="text-base tabular-nums font-medium" style={{ color: '#6B9DB8' }}>
                      {formatValue(loc.ytdCalls || 0)}
                    </span>
                  </td>
                )}
                {/* ServiceTitan columns */}
                {hasSTData && (
                  <>
                    <td className="py-3.5 px-1 w-px" style={{ borderLeft: '2px solid var(--border-subtle)' }}></td>
                    <td className="py-3.5 px-3 text-right">
                      {loc.hasSTCampaign ? (
                        <span className="text-base font-semibold tabular-nums" style={{ color: '#5D8A66' }}>
                          {formatValue(loc.stCallsBooked || 0)}
                        </span>
                      ) : (
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      {loc.hasSTCampaign ? (
                        <span className="text-base font-semibold tabular-nums" style={{ color: '#5D8A66' }}>
                          {formatCurrency(loc.stRevenue || 0)}
                        </span>
                      ) : (
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      {loc.hasSTCampaign && loc.stJobCount && loc.stJobCount > 0 ? (
                        <span className="text-base tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {formatCurrency(loc.stAvgTicket || 0)}
                        </span>
                      ) : (
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border-subtle)' }}>
              <td className="py-3.5 px-3">
                <span className="text-base font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                  Total
                </span>
              </td>
              <td className="py-3.5 px-3 text-right">
                <span className="text-base font-bold tabular-nums" style={{ color: '#B8956B' }}>
                  {formatValue(totals.calls)}
                </span>
              </td>
              {hasYoYData && <td className="py-3.5 px-2"></td>}
              <td className="py-3.5 px-3 text-right">
                <span className="text-base font-semibold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {formatValue(totals.views)}
                </span>
              </td>
              {hasYoYData && <td className="py-3.5 px-2"></td>}
              <td className="py-3.5 px-3 text-right">
                <span className="text-base font-semibold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {formatValue(totals.clicks)}
                </span>
              </td>
              {hasYoYData && <td className="py-3.5 px-2"></td>}
              <td className="py-3.5 px-3 text-right">
                <span className="text-base font-semibold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {formatValue(totals.directions)}
                </span>
              </td>
              {hasYoYData && <td className="py-3.5 px-2"></td>}
              {hasYtdData && (
                <td className="py-3.5 px-3 text-right">
                  <span className="text-base font-bold tabular-nums" style={{ color: '#6B9DB8' }}>
                    {formatValue(totals.ytdCalls)}
                  </span>
                </td>
              )}
              {/* ServiceTitan totals */}
              {hasSTData && (
                <>
                  <td className="py-3.5 px-1 w-px" style={{ borderLeft: '2px solid var(--border-subtle)' }}></td>
                  <td className="py-3.5 px-3 text-right">
                    <span className="text-base font-bold tabular-nums" style={{ color: '#5D8A66' }}>
                      {formatValue(totals.stCallsBooked)}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <span className="text-base font-bold tabular-nums" style={{ color: '#5D8A66' }}>
                      {formatCurrency(totals.stRevenue)}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <span className="text-base font-semibold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {totalAvgTicket > 0 ? formatCurrency(totalAvgTicket) : '—'}
                    </span>
                  </td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      <div
        className="mt-4 pt-3 text-xs"
        style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
      >
        {data.length} locations &bull; Click headers to sort
        {hasSTData && (
          <span className="ml-2">&bull; ST = ServiceTitan actuals from call tracking</span>
        )}
      </div>
    </div>
  );
}

export default LocationSummaryTable;
