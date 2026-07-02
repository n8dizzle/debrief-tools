'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Estimate, getOptionTotal } from '@/types/estimate';
import { getAllEstimates, createBlankEstimate, saveEstimate, deleteEstimate } from '@/lib/store';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  presented: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
};

export default function EstimatesPage() {
  const router = useRouter();
  const [estimates, setEstimates] = useState<Estimate[]>([]);

  useEffect(() => {
    setEstimates(getAllEstimates().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }, []);

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage customer proposals</p>
        </div>
        <button
          onClick={handleNew}
          className="px-4 py-2 bg-[var(--christmas-green)] text-white rounded-lg font-medium text-sm hover:bg-[var(--christmas-green-dark)] transition-colors"
        >
          + New Estimate
        </button>
      </div>

      {estimates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">&#128203;</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No estimates yet</h3>
          <p className="text-gray-500 mb-4">Create your first estimate to get started</p>
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-[var(--christmas-green)] text-white rounded-lg font-medium text-sm hover:bg-[var(--christmas-green-dark)] transition-colors"
          >
            + New Estimate
          </button>
        </div>
      ) : (
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
                      {est.customerAddress && (
                        <div className="text-sm text-gray-500 truncate max-w-[200px]">{est.customerAddress}</div>
                      )}
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
      )}
    </div>
  );
}
