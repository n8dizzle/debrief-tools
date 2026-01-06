'use client';

import PacingSection from '@/components/dash/PacingSection';

// Mock data - will be replaced with API calls
const companyPacing = {
  today: { current: 129000, target: 34000 },
  week: { current: 95000, target: 184000 },
  month: { current: 450000, target: 821000 },
  year: { current: 450000, target: 15100000 },
};

const departmentPacing = [
  {
    name: 'HVAC Service',
    data: {
      today: { current: 45200, target: 12000 },
      week: { current: 45200, target: 84000 },
      month: { current: 320000, target: 305000 },
      year: { current: 320000, target: 3660000 },
    },
  },
  {
    name: 'HVAC Install',
    data: {
      today: { current: 55000, target: 18000 },
      week: { current: 55000, target: 126000 },
      month: { current: 280000, target: 304000 },
      year: { current: 280000, target: 3648000 },
    },
  },
  {
    name: 'Plumbing',
    data: {
      today: { current: 14200, target: 5000 },
      week: { current: 14200, target: 35000 },
      month: { current: 85000, target: 109000 },
      year: { current: 85000, target: 1308000 },
    },
  },
];

export default function PacingPage() {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--christmas-cream)' }}
        >
          Goal Pacing
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Company and department revenue tracking against targets
        </p>
      </div>

      {/* Company-Wide Pacing */}
      <div className="mb-8">
        <PacingSection data={companyPacing} title="Company Revenue Pacing" />
      </div>

      {/* Department Breakdowns */}
      <div className="space-y-6">
        {departmentPacing.map((dept) => (
          <PacingSection
            key={dept.name}
            data={dept.data}
            title={dept.name}
          />
        ))}
      </div>
    </div>
  );
}
