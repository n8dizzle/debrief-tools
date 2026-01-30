'use client';

import { useState } from 'react';
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

export default function TrackerList({ initialTrackers, initialFilters }: TrackerListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialFilters.search || '');
  const [status, setStatus] = useState(initialFilters.status || 'all');
  const [trade, setTrade] = useState(initialFilters.trade || 'all');

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
          <div className="overflow-x-auto">
            <table className="tracker-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Trade</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {initialTrackers.map((tracker) => (
                  <tr key={tracker.id}>
                    <td>
                      <Link
                        href={`/trackers/${tracker.id}`}
                        className="font-medium text-text-primary hover:text-christmas-green-light"
                      >
                        {tracker.customer_name}
                      </Link>
                      {tracker.job_number && (
                        <p className="text-xs text-text-muted">Job #{tracker.job_number}</p>
                      )}
                      <p className="text-xs text-text-muted font-mono">{tracker.tracking_code}</p>
                    </td>
                    <td>
                      <span className={`badge ${tracker.trade === 'hvac' ? 'badge-hvac' : 'badge-plumbing'}`}>
                        {tracker.trade.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-text-secondary capitalize">{tracker.job_type}</td>
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
                        <div className="w-20 h-2 bg-border-default rounded-full overflow-hidden">
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
                    <td className="text-text-muted text-sm">
                      {new Date(tracker.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
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
                          title="View public tracker"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
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
        )}
      </div>
    </div>
  );
}
