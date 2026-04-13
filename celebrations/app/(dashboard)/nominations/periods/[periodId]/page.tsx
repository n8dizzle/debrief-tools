'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CelNominationPeriod, CelNomination, NominationPeriodStatus, getCategoryByKey } from '@/lib/supabase';
import { useCelebrationsPermissions } from '@/hooks/useCelebrationsPermissions';
import { CopyButton } from '@/components/NominationCard';

export default function PeriodDashboardPage() {
  const { periodId } = useParams();
  const router = useRouter();
  const { isManager, isOwner } = useCelebrationsPermissions();

  const [period, setPeriod] = useState<CelNominationPeriod | null>(null);
  const [nominations, setNominations] = useState<CelNomination[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState<string>('all');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingPeriod, setDeletingPeriod] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<'nominee' | 'nominator' | 'category' | 'source' | 'date'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [winners, setWinners] = useState<Record<string, string>>({});
  const [savingWinners, setSavingWinners] = useState(false);
  const [winnersSaved, setWinnersSaved] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [showTrophyOrder, setShowTrophyOrder] = useState(false);

  const canManage = isManager || isOwner;
  const categories = period?.categories || [];

  async function loadData() {
    try {
      const res = await fetch(`/api/nominations/periods/${periodId}`);
      if (!res.ok) {
        router.push('/nominations');
        return;
      }
      const data = await res.json();
      setPeriod(data.period);
      setNominations(data.nominations);
      setWinners(data.period.winners || {});
    } catch (err) {
      console.error('Failed to load period:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [periodId]);

  async function handleStatusChange(newStatus: NominationPeriodStatus) {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/nominations/periods/${periodId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setPeriod(data.period);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this nomination?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/nominations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNominations((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeletePeriod() {
    if (!confirm(`Delete "${period?.title}" and all its nominations? This cannot be undone.`)) return;
    setDeletingPeriod(true);
    try {
      const res = await fetch(`/api/nominations/periods/${periodId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/nominations');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete period');
      }
    } catch (err) {
      console.error('Failed to delete period:', err);
    } finally {
      setDeletingPeriod(false);
    }
  }

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  // Get unique nominee names per category
  const nomineesByCategory = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const cat of categories) {
      const names = [...new Set(
        nominations
          .filter((n) => n.company_value === cat.key)
          .map((n) => n.nominee_name)
      )].sort();
      map[cat.key] = names;
    }
    return map;
  }, [nominations, categories]);

  async function handleSaveWinners() {
    setSavingWinners(true);
    try {
      const res = await fetch(`/api/nominations/periods/${periodId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winners }),
      });
      if (res.ok) {
        const data = await res.json();
        setPeriod(data.period);
        setWinnersSaved(true);
        setTimeout(() => setWinnersSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save winners:', err);
    } finally {
      setSavingWinners(false);
    }
  }

  const isQuarterly = period?.period_type === 'quarterly';
  const periodLabel = isQuarterly && period?.quarter
    ? `${period.quarter}Q${period.year || new Date().getFullYear()}`
    : `${period?.year || new Date().getFullYear()}`;
  const awardType = isQuarterly ? 'quarterly' : 'annual';

  function generateTrophyEmail() {
    const winnerCount = Object.keys(winners).filter(k => winners[k]).length;
    const lines: string[] = [];
    lines.push('Hi,');
    lines.push('');
    lines.push(`I'd like to order ${winnerCount} ${winnerCount === 1 ? 'trophy' : 'trophies'} for our ${awardType} awards (${periodLabel}). Here are the details for each:`);
    lines.push('');

    for (const cat of categories) {
      const winnerName = winners[cat.key];
      if (!winnerName) continue;
      lines.push('---');
      lines.push(`Company: Christmas Air and Plumbing`);
      lines.push(`Period: ${periodLabel}`);
      lines.push(`Award: ${cat.label}`);
      lines.push(`Recipient: ${winnerName}`);
      lines.push(`Logo: Christmas Air logo (on file)`);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('Please let me know the estimated timeline and cost.');
    lines.push('');
    lines.push('Thank you!');
    return lines.join('\n');
  }

  const filtered = useMemo(() => {
    let results = nominations;
    if (filterValue !== 'all') {
      results = results.filter((n) => n.company_value === filterValue);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      results = results.filter((n) =>
        n.nominee_name.toLowerCase().includes(q) ||
        n.nominator_name.toLowerCase().includes(q) ||
        n.story.toLowerCase().includes(q)
      );
    }
    const sorted = [...results].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'nominee': cmp = a.nominee_name.localeCompare(b.nominee_name); break;
        case 'nominator': cmp = a.nominator_name.localeCompare(b.nominator_name); break;
        case 'category': cmp = a.company_value.localeCompare(b.company_value); break;
        case 'source': cmp = (a.source || 'form').localeCompare(b.source || 'form'); break;
        case 'date': cmp = a.created_at.localeCompare(b.created_at); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [nominations, filterValue, search, sortCol, sortDir]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--christmas-green)' }} />
      </div>
    );
  }

  if (!period) return null;

  const statusStyles: Record<NominationPeriodStatus, { bg: string; color: string }> = {
    draft: { bg: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af' },
    open: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
    closed: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
  };

  const categoryCounts = categories.map((v) => ({
    ...v,
    count: nominations.filter((n) => n.company_value === v.key).length,
  }));

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {period.title}
            </h1>
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize"
              style={statusStyles[period.status]}
            >
              {period.status}
            </span>
          </div>
          {period.description && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{period.description}</p>
          )}
          {period.status === 'open' && (
            <div className="mt-2 flex items-center gap-2">
              <a
                href="https://celebrate.christmasair.com/nominate"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  color: '#22c55e',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                }}
              >
                Nomination Form
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('https://celebrate.christmasair.com/nominate');
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  color: copiedLink ? '#22c55e' : 'var(--text-muted)',
                  background: copiedLink ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                }}
                title="Copy link"
              >
                {copiedLink ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Status toggle buttons */}
        {canManage && (
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {(['draft', 'open', 'closed'] as NominationPeriodStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={updatingStatus || period.status === s}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                  style={{
                    background: period.status === s ? statusStyles[s].bg : 'var(--bg-card)',
                    color: period.status === s ? statusStyles[s].color : 'var(--text-muted)',
                    border: `1px solid ${period.status === s ? statusStyles[s].color : 'var(--border-subtle)'}`,
                    opacity: updatingStatus ? 0.5 : 1,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              onClick={() => router.push(`/nominations/periods/${periodId}/edit`)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              Edit
            </button>
            {isOwner && (
              <button
                onClick={handleDeletePeriod}
                disabled={deletingPeriod}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  opacity: deletingPeriod ? 0.5 : 1,
                }}
              >
                {deletingPeriod ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      {categoryCounts.length > 0 && (
        <div className={`grid gap-3 mb-6 ${categoryCounts.length <= 4 ? `grid-cols-2 sm:grid-cols-${categoryCounts.length}` : 'grid-cols-2 sm:grid-cols-4'}`}>
          {categoryCounts.map((v) => (
            <div
              key={v.key}
              className="rounded-lg p-3 text-center"
              style={{ background: v.bgColor, border: `1px solid ${v.color}33` }}
            >
              <div className="text-xl">{v.emoji}</div>
              <div className="text-2xl font-bold" style={{ color: v.color }}>{v.count}</div>
              <div className="text-xs font-medium" style={{ color: v.color }}>{v.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Winners & Trophy Order */}
      {canManage && categories.length > 0 && (
        <div
          className="rounded-xl mb-6 overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <button
            onClick={() => setShowTrophyOrder(!showTrophyOrder)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
            style={{ borderBottom: showTrophyOrder ? '1px solid var(--border-subtle)' : 'none' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <span className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                Winners & Trophy Order
              </span>
              {Object.values(winners).filter(Boolean).length > 0 && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}
                >
                  {Object.values(winners).filter(Boolean).length} / {categories.length} selected
                </span>
              )}
            </div>
            <svg
              className="w-4 h-4 transition-transform"
              style={{
                color: 'var(--text-muted)',
                transform: showTrophyOrder ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showTrophyOrder && (
            <div className="p-5 space-y-5">
              {/* Winner Selection */}
              <div>
                <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Select a winner for each category
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categories.map((cat) => {
                    const nominees = nomineesByCategory[cat.key] || [];
                    return (
                      <div
                        key={cat.key}
                        className="rounded-lg p-3"
                        style={{
                          background: winners[cat.key] ? cat.bgColor : 'var(--bg-secondary)',
                          border: `1px solid ${winners[cat.key] ? cat.color + '44' : 'var(--border-subtle)'}`,
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span>{cat.emoji}</span>
                          <span className="text-sm font-medium" style={{ color: cat.color }}>{cat.label}</span>
                        </div>
                        {nominees.length > 0 ? (
                          <select
                            value={winners[cat.key] || ''}
                            onChange={(e) => setWinners((prev) => ({ ...prev, [cat.key]: e.target.value }))}
                            className="w-full rounded-md px-3 py-2 text-sm"
                            style={{
                              background: 'var(--bg-main)',
                              color: 'var(--christmas-cream)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <option value="">-- Select winner --</option>
                            {nominees.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No nominees in this category</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={handleSaveWinners}
                    disabled={savingWinners}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: 'var(--christmas-green)',
                      color: 'var(--christmas-cream)',
                      opacity: savingWinners ? 0.5 : 1,
                    }}
                  >
                    {savingWinners ? 'Saving...' : winnersSaved ? 'Saved!' : 'Save Winners'}
                  </button>
                  {winnersSaved && (
                    <span className="text-xs" style={{ color: '#22c55e' }}>Winners saved successfully</span>
                  )}
                </div>
              </div>

              {/* Trophy Order Email */}
              {Object.values(winners).some(Boolean) && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Trophy Order Email
                    </h3>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generateTrophyEmail());
                        setCopiedEmail(true);
                        setTimeout(() => setCopiedEmail(false), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: copiedEmail ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                        color: copiedEmail ? '#22c55e' : '#eab308',
                        border: `1px solid ${copiedEmail ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
                      }}
                    >
                      {copiedEmail ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Email
                        </>
                      )}
                    </button>
                  </div>
                  <pre
                    className="rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed"
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                      fontFamily: 'inherit',
                    }}
                  >
                    {generateTrophyEmail()}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterValue('all')}
            className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              background: filterValue === 'all' ? 'var(--christmas-green)' : 'var(--bg-card)',
              color: filterValue === 'all' ? 'var(--christmas-cream)' : 'var(--text-muted)',
              border: `1px solid ${filterValue === 'all' ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
            }}
          >
            All ({nominations.length})
          </button>
          {categories.map((v) => {
            const count = nominations.filter((n) => n.company_value === v.key).length;
            return (
              <button
                key={v.key}
                onClick={() => setFilterValue(filterValue === v.key ? 'all' : v.key)}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                style={{
                  background: filterValue === v.key ? v.bgColor : 'var(--bg-card)',
                  color: filterValue === v.key ? v.color : 'var(--text-muted)',
                  border: `1px solid ${filterValue === v.key ? v.color : 'var(--border-subtle)'}`,
                }}
              >
                {v.emoji} {count}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search names or stories..."
          className="input text-xs py-1 px-3"
          style={{ width: '220px' }}
        />
      </div>

      {/* Nominations Table */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No nominations {filterValue !== 'all' || search ? 'found' : 'yet'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                {([['nominee', 'Nominee'], ['nominator', 'Nominated By'], ['category', 'Category'], ['source', 'Source'], ['date', 'Date']] as const).map(([col, label]) => (
                  <th
                    key={col}
                    className="text-left px-4 py-3 font-medium cursor-pointer select-none"
                    style={{ color: sortCol === col ? 'var(--christmas-cream)' : 'var(--text-secondary)' }}
                    onClick={() => toggleSort(col)}
                  >
                    {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                ))}
                {canManage && (
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)', width: '60px' }}></th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => {
                const cat = getCategoryByKey(n.company_value, categories);
                const isExpanded = expandedId === n.id;
                return (
                  <tr
                    key={n.id}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isExpanded ? 'var(--bg-secondary)' : 'var(--bg-card)',
                    }}
                    onClick={() => setExpandedId(isExpanded ? null : n.id)}
                  >
                    <td className="px-4 py-3" style={{ color: 'var(--christmas-cream)' }}>
                      <div className="font-medium">{n.nominee_name}</div>
                      {isExpanded && (
                        <div className="mt-2 text-xs leading-relaxed flex items-start gap-1 group" style={{ color: 'var(--text-secondary)' }}>
                          <span className="flex-1">{n.story}</span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <CopyButton text={n.story} label="quote" />
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-0.5 group" style={{ color: 'var(--text-secondary)' }}>
                        {n.nominator_name}
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <CopyButton text={n.nominator_name} label="nominator" />
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {cat && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: cat.bgColor, color: cat.color }}
                        >
                          {cat.emoji} {cat.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                        style={{
                          background: n.source === 'voice' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(156, 163, 175, 0.1)',
                          color: n.source === 'voice' ? '#a78bfa' : 'var(--text-muted)',
                        }}
                      >
                        {n.source === 'voice' ? '🎙️ Voice' : '📝 Form'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {new Date(n.created_at).toLocaleDateString()}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                          disabled={deletingId === n.id}
                          className="text-xs px-2 py-1 rounded transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          title="Delete"
                        >
                          {deletingId === n.id ? '...' : '×'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
