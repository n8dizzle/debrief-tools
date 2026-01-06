'use client';

import { useState } from 'react';
import HistoricalTable from '@/components/huddle/HistoricalTable';

export default function DashHistoryPage() {
  const [days, setDays] = useState(7);

  const dayOptions = [
    { value: 7, label: 'Last 7 Days' },
    { value: 14, label: 'Last 14 Days' },
    { value: 30, label: 'Last 30 Days' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--christmas-cream)' }}
          >
            Historical Comparison
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Day-by-day KPI tracking with color-coded performance
          </p>
        </div>

        {/* Day selector */}
        <div className="flex items-center gap-2">
          {dayOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setDays(option.value)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                days === option.value ? 'font-medium' : ''
              }`}
              style={{
                backgroundColor:
                  days === option.value
                    ? 'var(--christmas-green)'
                    : 'var(--bg-card)',
                color:
                  days === option.value
                    ? 'var(--christmas-cream)'
                    : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Historical Table */}
      <HistoricalTable days={days} />
    </div>
  );
}
