'use client';

import PacingCard from './PacingCard';

interface PacingData {
  today: { current: number; target: number };
  week: { current: number; target: number };
  month: { current: number; target: number };
  year: { current: number; target: number };
}

interface PacingSectionProps {
  data: PacingData;
  title?: string;
  format?: 'currency' | 'number' | 'percent';
}

export default function PacingSection({
  data,
  title = 'Goal Pacing',
  format = 'currency',
}: PacingSectionProps) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'rgba(93, 138, 102, 0.2)' }}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="var(--christmas-green)"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
          {title}
        </h3>
      </div>

      {/* Pacing Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PacingCard
          label="Today"
          current={data.today.current}
          target={data.today.target}
          format={format}
        />
        <PacingCard
          label="This Week"
          current={data.week.current}
          target={data.week.target}
          format={format}
        />
        <PacingCard
          label="This Month"
          current={data.month.current}
          target={data.month.target}
          format={format}
        />
        <PacingCard
          label="This Year"
          current={data.year.current}
          target={data.year.target}
          format={format}
        />
      </div>
    </div>
  );
}
