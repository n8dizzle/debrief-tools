'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ARNoteType, ARContactResult, PortalUser } from '@/lib/supabase';
import { formatNoteDate, formatCurrency, formatActivityDate } from '@/lib/ar-utils';

interface Activity {
  id: string;
  invoice_id: string | null;
  customer_id: string | null;
  note_date: string;
  author_initials: string;
  content: string;
  note_type: ARNoteType;
  contact_result: ARContactResult | null;
  spoke_with: string | null;
  promised_amount: number | null;
  promised_date: string | null;
  created_at: string;
  invoice_number?: string;
  customer_name?: string;
  balance?: number;
}

type FilterState = {
  types: string[];
  dateFrom: string;
  dateTo: string;
  ownerId: string;
};

const NOTE_TYPE_OPTIONS = [
  { value: 'call', label: 'Calls' },
  { value: 'email', label: 'Emails' },
  { value: 'text', label: 'Texts' },
  { value: 'task', label: 'Tasks' },
  { value: 'note', label: 'Notes' },
];

function getNoteTypeIcon(type: ARNoteType): JSX.Element {
  const iconClass = "w-5 h-5";

  switch (type) {
    case 'call':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      );
    case 'email':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case 'text':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case 'task':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      );
    case 'status_change':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case 'payment_promise':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'note':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      );
  }
}

function getNoteTypeColor(type: ARNoteType): string {
  switch (type) {
    case 'call':
      return 'var(--christmas-green-light)';
    case 'email':
      return '#60a5fa'; // blue
    case 'text':
      return '#a78bfa'; // purple
    case 'task':
      return '#fbbf24'; // yellow
    case 'status_change':
      return '#f97316'; // orange
    case 'payment_promise':
      return '#34d399'; // green
    case 'note':
      return '#14b8a6'; // teal
    default:
      return 'var(--text-secondary)';
  }
}

function getContactResultLabel(result: ARContactResult | null): string {
  if (!result) return '';
  switch (result) {
    case 'reached': return 'Reached';
    case 'voicemail': return 'Voicemail';
    case 'no_answer': return 'No Answer';
    case 'left_message': return 'Left Message';
    default: return result;
  }
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [owners, setOwners] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    types: [],
    dateFrom: '',
    dateTo: '',
    ownerId: '',
  });
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  useEffect(() => {
    fetchActivities();
    fetchOwners();
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [filters]);

  async function fetchActivities() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.types.length > 0) params.set('types', filters.types.join(','));
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.ownerId) params.set('ownerId', filters.ownerId);
      params.set('limit', '100');

      const response = await fetch(`/api/activity?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch activities');
      const data = await response.json();
      setActivities(data.activities || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOwners() {
    try {
      const response = await fetch('/api/users', {
        credentials: 'include',
      });
      if (!response.ok) return;
      const data = await response.json();
      setOwners(data.users || []);
    } catch (err) {
      console.error('Failed to fetch owners:', err);
    }
  }

  // Get today's date and 7 days ago for date filter defaults
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Activity Timeline
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Recent collection activity across all invoices
        </p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="relative">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Activity Type
            </label>
            <button
              type="button"
              className="select w-full text-left flex items-center justify-between"
              onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
            >
              <span style={{ color: filters.types.length === 0 ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                {filters.types.length === 0
                  ? 'All Types'
                  : filters.types.length === 1
                    ? NOTE_TYPE_OPTIONS.find(o => o.value === filters.types[0])?.label
                    : `${filters.types.length} selected`}
              </span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {typeDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setTypeDropdownOpen(false)}
                />
                <div
                  className="absolute z-20 mt-1 w-full rounded-md shadow-lg"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <button
                      type="button"
                      className="text-xs hover:underline"
                      style={{ color: 'var(--christmas-green-light)' }}
                      onClick={() => setFilters(prev => ({ ...prev, types: [] }))}
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                    {NOTE_TYPE_OPTIONS.map(option => (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-opacity-50"
                        style={{ backgroundColor: filters.types.includes(option.value) ? 'var(--bg-secondary)' : 'transparent' }}
                      >
                        <input
                          type="checkbox"
                          checked={filters.types.includes(option.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters(prev => ({ ...prev, types: [...prev.types, option.value] }));
                            } else {
                              setFilters(prev => ({ ...prev, types: prev.types.filter(t => t !== option.value) }));
                            }
                          }}
                          className="rounded"
                          style={{ accentColor: 'var(--christmas-green-light)' }}
                        />
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              From Date
            </label>
            <input
              type="date"
              className="input"
              value={filters.dateFrom}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              To Date
            </label>
            <input
              type="date"
              className="input"
              value={filters.dateTo}
              onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Invoice Owner
            </label>
            <select
              className="select"
              value={filters.ownerId}
              onChange={(e) => setFilters(prev => ({ ...prev, ownerId: e.target.value }))}
            >
              <option value="">All Owners</option>
              {owners.map(owner => (
                <option key={owner.id} value={owner.id}>{owner.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Activity Count */}
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Showing {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
        {total > activities.length && ` of ${total} total`}
      </div>

      {/* Activity List */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div style={{ color: 'var(--text-muted)' }}>Loading activities...</div>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            No activity found
          </div>
        ) : (
          <div className="relative">
            {activities.map((activity, index) => {
              const isLast = index === activities.length - 1;
              const typeColor = getNoteTypeColor(activity.note_type);

              return (
                <div key={activity.id} className="relative flex gap-4 pb-6">
                  {/* Timeline connector */}
                  {!isLast && (
                    <div
                      className="absolute left-[15px] top-8 w-0.5 h-full"
                      style={{ backgroundColor: 'var(--border-subtle)' }}
                    />
                  )}

                  {/* Icon */}
                  <div
                    className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: typeColor }}
                  >
                    {getNoteTypeIcon(activity.note_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: typeColor }}>
                        {formatActivityDate(activity.created_at)}
                      </span>
                      <span className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {activity.author_initials?.toUpperCase()}
                      </span>
                      {activity.contact_result && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                        >
                          {getContactResultLabel(activity.contact_result)}
                        </span>
                      )}
                      {activity.spoke_with && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          w/ {activity.spoke_with}
                        </span>
                      )}
                    </div>

                    {/* Invoice link */}
                    {activity.invoice_id && activity.invoice_number && (
                      <div className="mt-1 flex items-center gap-2">
                        <Link
                          href={`/invoices/${activity.invoice_id}`}
                          className="text-sm font-medium hover:underline"
                          style={{ color: 'var(--christmas-green-light)' }}
                        >
                          #{activity.invoice_number}
                        </Link>
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {activity.customer_name}
                        </span>
                        {activity.balance !== undefined && activity.balance > 0 && (
                          <span className="text-xs" style={{ color: 'var(--status-error)' }}>
                            {formatCurrency(activity.balance)} due
                          </span>
                        )}
                      </div>
                    )}

                    {/* Note content */}
                    {activity.content && (
                      <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {activity.content}
                      </p>
                    )}

                    {/* Payment promise info */}
                    {activity.promised_amount && (
                      <div className="mt-2 text-sm" style={{ color: 'var(--status-success)' }}>
                        Payment promised: ${activity.promised_amount.toLocaleString()}
                        {activity.promised_date && ` by ${formatNoteDate(activity.promised_date)}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
