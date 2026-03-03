'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { DdDocument } from '@/lib/supabase';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'complete', label: 'Complete' },
];

const PRIORITY_FILTERS = [
  { value: '', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function formatDocType(type: string | null): string {
  if (!type) return 'Unknown';
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  const label = status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`badge badge-${status.replace('_', '-')}`}>{label}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`badge badge-${priority}`}>{priority}</span>;
}

export default function InboxPage() {
  const [documents, setDocuments] = useState<DdDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('incomplete');
  const [priority, setPriority] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [staffList, setStaffList] = useState<{ id: string; name: string; email: string }[]>([]);

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setStaffList(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [status, priority, assignedTo, search]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      if (assignedTo) params.set('assigned_to', assignedTo);
      if (search) params.set('search', search);
      params.set('limit', '100');

      const res = await fetch(`/api/documents?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setDocuments(data.documents || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Inbox
        </h1>
        <Link href="/scan" className="btn btn-primary gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Scan
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search documents..."
              className="input flex-1"
            />
            <button type="submit" className="btn btn-secondary">Search</button>
          </form>
          <div className="flex gap-2">
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setStatus(f.value)}
                  className="px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: status === f.value ? 'var(--christmas-green)' : 'transparent',
                    color: status === f.value ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="select"
              style={{ width: 'auto' }}
            >
              {PRIORITY_FILTERS.map(f => (
                <option key={f.value} value={f.value}>{f.label} Priority</option>
              ))}
            </select>
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              className="select"
              style={{ width: 'auto' }}
            >
              <option value="">All Owners</option>
              <option value="unassigned">Unassigned</option>
              {staffList.map(u => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12">
          <svg className="w-8 h-8 animate-spin mx-auto" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--christmas-green)' }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p style={{ color: 'var(--text-muted)' }}>No documents found.</p>
          <Link href="/scan" className="btn btn-primary mt-4">Scan your first document</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map(doc => {
            const actionItems = (doc.action_items || []) as any[];
            const pendingCount = actionItems.filter((a: any) => a.status === 'pending' || a.status === 'in_progress').length;

            return (
              <Link
                key={doc.id}
                href={`/documents/${doc.id}`}
                className="card block"
                style={{ textDecoration: 'none' }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {doc.title || 'Untitled Document'}
                      </h3>
                      <StatusBadge status={doc.status} />
                      <PriorityBadge priority={doc.priority} />
                    </div>
                    <p className="text-sm truncate mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {doc.summary || formatDocType(doc.document_type)}
                    </p>
                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>{timeAgo(doc.created_at)}</span>
                      {doc.document_type && <span>{formatDocType(doc.document_type)}</span>}
                      {(doc as any).owner && (
                        <span>{(doc as any).owner.name || (doc as any).owner.email}</span>
                      )}
                      {pendingCount > 0 && (
                        <span style={{ color: 'var(--christmas-gold)' }}>
                          {pendingCount} action{pendingCount !== 1 ? 's' : ''} pending
                        </span>
                      )}
                    </div>
                  </div>
                  <svg className="w-5 h-5 flex-shrink-0 mt-1" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}

          {total > documents.length && (
            <p className="text-center text-sm py-4" style={{ color: 'var(--text-muted)' }}>
              Showing {documents.length} of {total} documents
            </p>
          )}
        </div>
      )}
    </div>
  );
}
