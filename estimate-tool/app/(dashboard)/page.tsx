'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Estimate, getOptionTotal } from '@/types/estimate';
import { getAllEstimates, createBlankEstimate, saveEstimate, deleteEstimate } from '@/lib/store';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  presented: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
};

interface SearchResult {
  jobId: number;
  jobNumber: string;
  jobStatus: string;
  businessUnitName?: string;
  customerId: number;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  locationId: number;
}

export default function EstimatesPage() {
  const router = useRouter();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setEstimates(getAllEstimates().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }, []);

  async function handleSearch(query?: string) {
    const q = (query ?? searchQuery).trim();
    if (q.length < 2) return;
    setSearching(true);
    setSearchError('');

    try {
      const res = await fetch(`/api/servicetitan/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const data = await res.json();
        setSearchError(data.error || 'Search failed');
        setResults([]);
        return;
      }
      const data = await res.json();
      setResults(data.results || []);
      setShowResults(true);
      if (data.results.length === 0) setSearchError('No results found');
    } catch {
      setSearchError('Failed to connect to ServiceTitan');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleInputChange(value: string) {
    setSearchQuery(value);
    setSearchError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 3) {
      debounceRef.current = setTimeout(() => handleSearch(value), 500);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }

  function handleStartFromResult(result: SearchResult) {
    // Check if estimate already exists for this job
    const existing = result.jobNumber
      ? estimates.find(e => e.stJobNumber === result.jobNumber)
      : null;

    if (existing) {
      router.push(`/estimates/${existing.id}`);
      return;
    }

    const est = createBlankEstimate();
    est.customerName = result.customerName;
    est.customerAddress = result.address;
    est.customerPhone = result.phone;
    est.customerEmail = result.email;
    est.stJobId = result.jobId || undefined;
    est.stJobNumber = result.jobNumber || undefined;
    est.stCustomerId = result.customerId;
    est.stLocationId = result.locationId || undefined;
    saveEstimate(est);
    router.push(`/estimates/${est.id}`);
  }

  function handleNew() {
    const est = createBlankEstimate();
    saveEstimate(est);
    router.push(`/estimates/${est.id}`);
  }

  function handleDelete(id: string) {
    deleteEstimate(id);
    setEstimates(prev => prev.filter(e => e.id !== id));
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
          <p className="text-sm text-gray-500 mt-1">Search ServiceTitan to start a new estimate</p>
        </div>
        <button
          onClick={handleNew}
          className="px-4 py-2 bg-[var(--christmas-green)] text-white rounded-lg font-medium text-sm hover:bg-[var(--christmas-green-dark)] transition-colors"
        >
          + Manual Estimate
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by customer name, phone number, or job number..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent"
              autoFocus
            />
            {searching && (
              <div className="absolute right-3 top-2.5">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={searching || searchQuery.trim().length < 2}
            className="px-5 py-2 bg-[var(--christmas-green)] text-white rounded-lg font-medium text-sm hover:bg-[var(--christmas-green-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Search
          </button>
        </div>

        {/* Search Results */}
        {showResults && results.length > 0 && (
          <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
            {results.map((result, idx) => {
              const existingEst = result.jobNumber
                ? estimates.find(e => e.stJobNumber === result.jobNumber)
                : null;

              return (
                <button
                  key={`${result.customerId}-${result.jobId}-${idx}`}
                  onClick={() => handleStartFromResult(result)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{result.customerName}</div>
                    {result.address && (
                      <div className="text-sm text-gray-500 truncate mt-0.5">{result.address}</div>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      {result.phone && <span>{formatPhone(result.phone)}</span>}
                      {result.email && <span>{result.email}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {result.jobNumber ? (
                      <div>
                        <div className="text-xs font-medium text-blue-600">Job #{result.jobNumber}</div>
                        <div className="text-xs text-gray-400">{result.jobStatus}</div>
                        {result.businessUnitName && (
                          <div className="text-xs text-gray-400">{result.businessUnitName}</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">No active job</div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {existingEst ? (
                      <span className={`badge ${statusColors[existingEst.status]} text-xs`}>
                        {existingEst.status.charAt(0).toUpperCase() + existingEst.status.slice(1)}
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 bg-[var(--christmas-green)] text-white rounded-lg text-xs font-medium">
                        Start Estimate
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {showResults && results.length === 0 && !searching && searchError && (
          <div className="mt-4 text-sm text-gray-500 text-center py-3">{searchError}</div>
        )}
      </div>

      {/* Existing Estimates */}
      {estimates.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Estimates</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Options</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Range</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Updated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {estimates.map(est => {
                  const totals = est.options.map(getOptionTotal).filter(t => t > 0);
                  const minTotal = totals.length ? Math.min(...totals) : 0;
                  const maxTotal = totals.length ? Math.max(...totals) : 0;
                  return (
                    <tr
                      key={est.id}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/estimates/${est.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{est.customerName || 'Unnamed Customer'}</div>
                        <div className="text-sm text-gray-500 truncate max-w-[200px]">
                          {est.stJobNumber && <span className="text-blue-600 font-medium">Job #{est.stJobNumber} </span>}
                          {est.customerAddress}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {est.options.length} option{est.options.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {totals.length > 0
                          ? minTotal === maxTotal
                            ? formatCurrency(minTotal)
                            : `${formatCurrency(minTotal)} - ${formatCurrency(maxTotal)}`
                          : '—'
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${statusColors[est.status]}`}>
                          {est.status.charAt(0).toUpperCase() + est.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(est.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(est.id); }}
                          className="text-gray-400 hover:text-red-500 transition-colors text-sm"
                          title="Delete"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
