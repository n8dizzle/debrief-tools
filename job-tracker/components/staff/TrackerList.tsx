'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { JobTracker } from '@/lib/supabase';

interface TrackerListProps {
  initialTrackers: JobTracker[];
  initialFilters: {
    status?: string;
    trade?: string;
    search?: string;
  };
}

type SortField = 'customer_name' | 'trade' | 'job_type' | 'status' | 'progress_percent' | 'scheduled_date';
type SortDirection = 'asc' | 'desc';

interface ColumnConfig {
  key: string;
  label: string;
  sortField?: SortField;
  minWidth: number;
  defaultWidth: number;
}

const COLUMNS: ColumnConfig[] = [
  { key: 'customer', label: 'Customer', sortField: 'customer_name', minWidth: 150, defaultWidth: 200 },
  { key: 'trade', label: 'Trade', sortField: 'trade', minWidth: 70, defaultWidth: 85 },
  { key: 'type', label: 'Type', sortField: 'job_type', minWidth: 70, defaultWidth: 90 },
  { key: 'status', label: 'Status', sortField: 'status', minWidth: 80, defaultWidth: 95 },
  { key: 'progress', label: 'Progress', sortField: 'progress_percent', minWidth: 100, defaultWidth: 120 },
  { key: 'startDate', label: 'Start Date', sortField: 'scheduled_date', minWidth: 90, defaultWidth: 105 },
  { key: 'actions', label: 'Actions', minWidth: 100, defaultWidth: 110 },
];

const STORAGE_KEY = 'tracker-list-column-widths';

export default function TrackerList({ initialTrackers, initialFilters }: TrackerListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialFilters.search || '');
  const [status, setStatus] = useState(initialFilters.status || 'all');
  const [trade, setTrade] = useState(initialFilters.trade || 'all');
  const [sortField, setSortField] = useState<SortField>('scheduled_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Column widths state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return Object.fromEntries(COLUMNS.map(col => [col.key, col.defaultWidth]));
  });

  // Resizing state
  const [resizing, setResizing] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Save column widths to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columnWidths));
  }, [columnWidths]);

  const handleMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(columnKey);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[columnKey];
  }, [columnWidths]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;

    const diff = e.clientX - resizeStartX.current;
    const column = COLUMNS.find(c => c.key === resizing);
    if (!column) return;

    const newWidth = Math.max(column.minWidth, resizeStartWidth.current + diff);
    setColumnWidths(prev => ({ ...prev, [resizing]: newWidth }));
  }, [resizing]);

  const handleMouseUp = useCallback(() => {
    setResizing(null);
  }, []);

  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [resizing, handleMouseMove, handleMouseUp]);

  const sortedTrackers = useMemo(() => {
    return [...initialTrackers].sort((a, b) => {
      let aVal: string | number | null = a[sortField];
      let bVal: string | number | null = b[sortField];

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal === null) return sortDirection === 'asc' ? -1 : 1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [initialTrackers, sortField, sortDirection]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return (
        <svg className="w-3 h-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  }

  function applyFilters(newSearch?: string, newStatus?: string, newTrade?: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (newSearch !== undefined) {
      if (newSearch) params.set('search', newSearch);
      else params.delete('search');
    }

    if (newStatus !== undefined) {
      if (newStatus !== 'all') params.set('status', newStatus);
      else params.delete('status');
    }

    if (newTrade !== undefined) {
      if (newTrade !== 'all') params.set('trade', newTrade);
      else params.delete('trade');
    }

    router.push(`/trackers?${params.toString()}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilters(search);
  }

  function copyLink(trackingCode: string) {
    const url = `${window.location.origin}/${trackingCode}`;
    navigator.clipboard.writeText(url);
  }

  function resetColumnWidths() {
    const defaults = Object.fromEntries(COLUMNS.map(col => [col.key, col.defaultWidth]));
    setColumnWidths(defaults);
  }

  return (
    <div>
      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by customer, job #, or tracking code..."
                className="input pl-10"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </form>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              applyFilters(undefined, e.target.value);
            }}
            className="select w-auto"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={trade}
            onChange={(e) => {
              setTrade(e.target.value);
              applyFilters(undefined, undefined, e.target.value);
            }}
            className="select w-auto"
          >
            <option value="all">All Trades</option>
            <option value="hvac">HVAC</option>
            <option value="plumbing">Plumbing</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="card">
        {initialTrackers.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="w-12 h-12 text-text-muted mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-text-secondary">No trackers found</p>
            <Link href="/trackers/new" className="text-christmas-green-light hover:underline text-sm mt-2 inline-block">
              Create a new tracker
            </Link>
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-2">
              <button
                onClick={resetColumnWidths}
                className="text-xs text-text-muted hover:text-text-secondary"
                title="Reset column widths"
              >
                Reset columns
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="tracker-table w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  {COLUMNS.map(col => (
                    <col key={col.key} style={{ width: columnWidths[col.key] }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {COLUMNS.map((col, idx) => (
                      <th
                        key={col.key}
                        className={`relative ${col.sortField ? 'cursor-pointer hover:bg-bg-card-hover' : ''} select-none`}
                        onClick={() => col.sortField && handleSort(col.sortField)}
                      >
                        <div className="flex items-center gap-1 pr-2">
                          {col.label}
                          {col.sortField && <SortIcon field={col.sortField} />}
                        </div>
                        {idx < COLUMNS.length - 1 && (
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-christmas-green/50 group"
                            onMouseDown={(e) => handleMouseDown(e, col.key)}
                          >
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-border-default group-hover:bg-christmas-green rounded" />
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTrackers.map((tracker) => (
                    <tr key={tracker.id}>
                      <td>
                        <div className="flex items-center gap-1 overflow-hidden">
                          <Link
                            href={`/trackers/${tracker.id}`}
                            className="font-medium text-text-primary hover:text-christmas-green-light truncate"
                          >
                            {tracker.customer_name}
                          </Link>
                          {tracker.st_customer_id && (
                            <a
                              href={`https://go.servicetitan.com/#/Customer/${tracker.st_customer_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
                              title="View customer in ServiceTitan"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-1 overflow-hidden">
                          <span className="text-xs text-text-muted truncate">Job #{tracker.job_number || tracker.tracking_code}</span>
                          {tracker.st_job_id && (
                            <a
                              href={`https://go.servicetitan.com/#/Job/Index/${tracker.st_job_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
                              title="View job in ServiceTitan"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${tracker.trade === 'hvac' ? 'badge-hvac' : 'badge-plumbing'}`}>
                          {tracker.trade.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-text-secondary capitalize truncate">{tracker.job_type}</td>
                      <td>
                        <span
                          className={`badge badge-${
                            tracker.status === 'active'
                              ? 'in-progress'
                              : tracker.status === 'completed'
                              ? 'completed'
                              : tracker.status === 'on_hold'
                              ? 'skipped'
                              : 'pending'
                          }`}
                        >
                          {tracker.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-2 bg-border-default rounded-full overflow-hidden flex-shrink-0">
                            <div
                              className={`h-full rounded-full ${
                                tracker.trade === 'hvac' ? 'bg-christmas-green' : 'bg-christmas-gold'
                              }`}
                              style={{ width: `${tracker.progress_percent}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-muted">{tracker.progress_percent}%</span>
                        </div>
                      </td>
                      <td className="text-text-muted text-sm truncate">
                        {tracker.scheduled_date
                          ? new Date(tracker.scheduled_date).toLocaleDateString()
                          : '-'}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyLink(tracker.tracking_code)}
                            className="p-1.5 rounded hover:bg-bg-card-hover text-text-muted hover:text-text-secondary"
                            title="Copy tracker link"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          </button>
                          <Link
                            href={`/${tracker.tracking_code}`}
                            target="_blank"
                            className="p-1.5 rounded hover:bg-bg-card-hover text-text-muted hover:text-text-secondary"
                            title="View customer tracker"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                              />
                            </svg>
                          </Link>
                          <Link
                            href={`/trackers/${tracker.id}`}
                            className="p-1.5 rounded hover:bg-bg-card-hover text-text-muted hover:text-text-secondary"
                            title="Edit tracker"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
