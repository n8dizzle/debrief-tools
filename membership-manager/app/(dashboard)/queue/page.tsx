'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MMMembership } from '@/lib/supabase';
import { formatDate, daysBetween, getVisitUrgency, getUrgencyColor } from '@/lib/mm-utils';

type QueueMembership = MMMembership & { trade?: string };

export default function ActionQueuePage() {
  const [queue, setQueue] = useState<QueueMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [trade, setTrade] = useState('');
  const [search, setSearch] = useState('');

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (overdueOnly) params.set('overdueOnly', 'true');
      if (trade) params.set('trade', trade);
      if (search) params.set('search', search);

      const res = await fetch(`/api/queue?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setQueue(data.queue || []);
      }
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  }, [overdueOnly, trade, search]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Action Queue
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Membership visits that need scheduling — sorted by most overdue first
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search customer or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
          style={{ maxWidth: '300px' }}
        />

        <select
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          className="select"
          style={{ maxWidth: '160px' }}
        >
          <option value="">All Trades</option>
          <option value="hvac">HVAC</option>
          <option value="plumbing">Plumbing</option>
        </select>

        <label
          className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm"
          style={{
            background: overdueOnly ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-card)',
            border: `1px solid ${overdueOnly ? 'var(--status-error)' : 'var(--border-default)'}`,
            color: overdueOnly ? 'var(--status-error)' : 'var(--text-secondary)',
          }}
        >
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="accent-current"
          />
          Overdue Only
        </label>

        <div className="flex-1" />

        <span className="text-sm self-center" style={{ color: 'var(--text-muted)' }}>
          {queue.length} result{queue.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full mx-auto mb-2" style={{ color: 'var(--christmas-green)' }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading queue...</p>
          </div>
        ) : queue.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p style={{ color: 'var(--text-muted)' }}>
              {overdueOnly ? 'No overdue visits. Great job!' : 'No visits need scheduling right now.'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="mm-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Address</th>
                  <th>Phone</th>
                  <th>Type</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Visits</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => {
                  const daysUntil = item.next_visit_due_date
                    ? daysBetween(item.next_visit_due_date)
                    : 0;
                  const urgency = getVisitUrgency(daysUntil);
                  const urgencyColor = getUrgencyColor(urgency);

                  return (
                    <tr key={item.id}>
                      <td>
                        <Link
                          href={`/memberships/${item.id}`}
                          className="font-medium"
                          style={{ color: 'var(--christmas-green-light)' }}
                        >
                          {item.customer_name || 'Unknown'}
                        </Link>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: '200px' }}>
                        {item.customer_address || '—'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {item.customer_phone || '—'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {item.membership_type_name || '—'}
                      </td>
                      <td>
                        <span style={{ color: urgencyColor }}>
                          {formatDate(item.next_visit_due_date)}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: `${urgencyColor}20`,
                            color: urgencyColor,
                          }}
                        >
                          {urgency === 'overdue'
                            ? `${Math.abs(daysUntil)}d overdue`
                            : urgency === 'due-soon'
                            ? `Due in ${daysUntil}d`
                            : `${daysUntil}d away`
                          }
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {item.total_visits_completed}/{item.total_visits_expected}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
