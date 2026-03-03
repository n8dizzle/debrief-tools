'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardStats {
  total: number;
  new: number;
  in_progress: number;
  high_priority: number;
  pending_actions: number;
}

interface RecentDoc {
  id: string;
  title: string | null;
  document_type: string | null;
  status: string;
  priority: string;
  summary: string | null;
  created_at: string;
  uploader?: { name: string; email: string };
  action_items?: { id: string; status: string }[];
}

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

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
        </div>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStats(data.stats);
      setRecentDocs(data.recent_documents || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--christmas-green)' }}>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>Dashboard</h1>
        <Link href="/scan" className="btn btn-primary gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Scan
        </Link>
      </div>

      {/* Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stat-grid">
          <StatCard
            label="New Documents"
            value={stats.new}
            color="#3b82f6"
            icon={<svg className="w-5 h-5" fill="none" stroke="#3b82f6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          />
          <StatCard
            label="In Progress"
            value={stats.in_progress}
            color="#eab308"
            icon={<svg className="w-5 h-5" fill="none" stroke="#eab308" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard
            label="High Priority"
            value={stats.high_priority}
            color="#ef4444"
            icon={<svg className="w-5 h-5" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
          />
          <StatCard
            label="Pending Actions"
            value={stats.pending_actions}
            color="#b8956b"
            icon={<svg className="w-5 h-5" fill="none" stroke="#b8956b" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
          />
        </div>
      )}

      {/* Recent Documents */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>Recent Documents</h2>
          <Link href="/inbox" className="text-sm" style={{ color: 'var(--christmas-green-light)' }}>View all</Link>
        </div>

        {recentDocs.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mb-3" style={{ color: 'var(--text-muted)' }}>No documents yet.</p>
            <Link href="/scan" className="btn btn-primary">Scan your first document</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentDocs.map(doc => {
              const pendingCount = (doc.action_items || []).filter(a => a.status === 'pending' || a.status === 'in_progress').length;
              return (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg transition-colors"
                  style={{ textDecoration: 'none', backgroundColor: 'transparent' }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                        {doc.title || 'Untitled Document'}
                      </span>
                      <span className={`badge badge-${doc.status.replace('_', '-')}`}>
                        {doc.status === 'in_progress' ? 'In Progress' : doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      <span>{formatDocType(doc.document_type)}</span>
                      <span>·</span>
                      <span>{timeAgo(doc.created_at)}</span>
                      {pendingCount > 0 && (
                        <>
                          <span>·</span>
                          <span style={{ color: 'var(--christmas-gold)' }}>{pendingCount} action{pendingCount !== 1 ? 's' : ''}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`badge badge-${doc.priority}`}>{doc.priority}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
