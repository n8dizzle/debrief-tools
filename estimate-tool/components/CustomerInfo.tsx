'use client';

import { useState, useRef } from 'react';
import { Estimate } from '@/types/estimate';

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

interface CustomerInfoProps {
  estimate: Estimate;
  onChange: (updates: Partial<Estimate>) => void;
  onContinue: () => void;
}

export default function CustomerInfo({ estimate, onChange, onContinue }: CustomerInfoProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  async function handleSearch(query?: string) {
    const q = (query ?? searchQuery).trim();
    if (q.length < 2) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/servicetitan/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Search failed');
        setResults([]);
        return;
      }

      const data = await res.json();
      setResults(data.results || []);
      setShowResults(true);

      if (data.results.length === 0) {
        setError('No results found');
      }
    } catch {
      setError('Failed to connect to ServiceTitan');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(value: string) {
    setSearchQuery(value);
    setError('');

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length >= 3) {
      debounceRef.current = setTimeout(() => handleSearch(value), 500);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }

  function handleSelectResult(result: SearchResult) {
    onChange({
      customerName: result.customerName,
      customerAddress: result.address,
      customerPhone: result.phone,
      customerEmail: result.email,
      stJobId: result.jobId || undefined,
      stJobNumber: result.jobNumber || undefined,
      stCustomerId: result.customerId,
      stLocationId: result.locationId || undefined,
    });
    setShowResults(false);
    setSearchQuery('');
  }

  function formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ST Search */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-blue-900 mb-1">Load from ServiceTitan</h3>
        <p className="text-xs text-blue-600 mb-3">Search by job number, customer name, phone number, or address.</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g. 12345678, Smith, (940) 555-1234"
              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
            />
            {loading && (
              <div className="absolute right-3 top-2.5">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={loading || searchQuery.trim().length < 2}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            Search
          </button>
        </div>

        {error && !showResults && <p className="text-xs text-red-600 mt-2">{error}</p>}

        {/* Search Results */}
        {showResults && results.length > 0 && (
          <div className="mt-3 bg-white border border-blue-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
            {results.map((result, idx) => (
              <button
                key={`${result.customerId}-${result.jobId}-${idx}`}
                onClick={() => handleSelectResult(result)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{result.customerName}</div>
                    {result.address && (
                      <div className="text-xs text-gray-500 truncate mt-0.5">{result.address}</div>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      {result.phone && <span>{formatPhone(result.phone)}</span>}
                      {result.email && <span>{result.email}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {result.jobNumber ? (
                      <>
                        <div className="text-xs font-medium text-blue-600">Job #{result.jobNumber}</div>
                        <div className="text-xs text-gray-400">{result.jobStatus}</div>
                        {result.businessUnitName && (
                          <div className="text-xs text-gray-400">{result.businessUnitName}</div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-gray-400">No active job</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {showResults && results.length === 0 && !loading && (
          <div className="mt-3 text-xs text-gray-500 text-center py-3">No results found for &ldquo;{searchQuery}&rdquo;</div>
        )}

        {estimate.stJobId && (
          <p className="text-xs text-green-700 mt-2">
            Linked to ST Job #{estimate.stJobNumber} (Customer: {estimate.customerName}, ID: {estimate.stCustomerId})
          </p>
        )}
        {estimate.stCustomerId && !estimate.stJobId && (
          <p className="text-xs text-amber-700 mt-2">
            Linked to ST Customer: {estimate.customerName} (ID: {estimate.stCustomerId}) — no job linked
          </p>
        )}
      </div>

      {/* Customer Info Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
            <input
              type="text"
              value={estimate.customerName}
              onChange={(e) => onChange({ customerName: e.target.value })}
              placeholder="John & Jane Smith"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={estimate.customerAddress}
              onChange={(e) => onChange({ customerAddress: e.target.value })}
              placeholder="123 Main St, Denton, TX 76201"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={estimate.customerPhone}
              onChange={(e) => onChange({ customerPhone: e.target.value })}
              placeholder="(940) 555-1234"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={estimate.customerEmail}
              onChange={(e) => onChange({ customerEmail: e.target.value })}
              placeholder="john@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comfort Advisor</label>
            <input
              type="text"
              value={estimate.advisorName}
              onChange={(e) => onChange({ advisorName: e.target.value })}
              placeholder="Advisor name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">System Type</label>
            <select
              value={estimate.systemType}
              onChange={(e) => onChange({ systemType: e.target.value as Estimate['systemType'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent"
            >
              <option value="replacement">Replacement</option>
              <option value="new-install">New Installation</option>
              <option value="add-on">Add-On / Upgrade</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Existing System</label>
            <input
              type="text"
              value={estimate.existingSystem || ''}
              onChange={(e) => onChange({ existingSystem: e.target.value })}
              placeholder="e.g., 15-year-old 10 SEER Trane AC + 80% furnace"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={estimate.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder="Any notes about the job, customer concerns, etc."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--christmas-green)] focus:border-transparent resize-none"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onContinue}
            className="px-6 py-2 bg-[var(--christmas-green)] text-white rounded-lg font-medium text-sm hover:bg-[var(--christmas-green-dark)] transition-colors"
          >
            Continue to Options &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
