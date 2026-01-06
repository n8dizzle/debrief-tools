'use client';

import { useParams } from 'next/navigation';
import PacingSection from '@/components/dash/PacingSection';

// Department name mapping
const departmentNames: Record<string, string> = {
  christmas: 'Christmas (Overall)',
  hvac: 'HVAC Overall',
  'hvac-service': 'HVAC Service',
  'hvac-install': 'HVAC Install',
  plumbing: 'Plumbing',
  'call-center': 'Call Center',
  marketing: 'Marketing',
  warehouse: 'Warehouse',
  finance: 'Finance',
};

// Mock data - will be replaced with API calls
const mockDepartmentData: Record<string, {
  pacing: {
    today: { current: number; target: number };
    week: { current: number; target: number };
    month: { current: number; target: number };
    year: { current: number; target: number };
  };
  kpis: Array<{
    name: string;
    value: string;
    target: string;
    pacing: number;
  }>;
}> = {
  christmas: {
    pacing: {
      today: { current: 129000, target: 34000 },
      week: { current: 95000, target: 184000 },
      month: { current: 450000, target: 821000 },
      year: { current: 450000, target: 15100000 },
    },
    kpis: [
      { name: 'Jobs Scheduled', value: '48', target: '45', pacing: 107 },
      { name: 'Yesterday Sales', value: '$68,500', target: '$75,000', pacing: 91 },
      { name: 'Revenue Completed', value: '$72,000', target: '$65,000', pacing: 111 },
    ],
  },
  'hvac-service': {
    pacing: {
      today: { current: 45200, target: 12000 },
      week: { current: 45200, target: 84000 },
      month: { current: 320000, target: 305000 },
      year: { current: 320000, target: 3660000 },
    },
    kpis: [
      { name: 'Jobs Completed', value: '32', target: '35', pacing: 91 },
      { name: 'Average Ticket', value: '$485', target: '$450', pacing: 108 },
      { name: 'Zero Dollar %', value: '3%', target: '5%', pacing: 167 },
      { name: 'Leads Set', value: '6', target: '8', pacing: 75 },
      { name: 'Recalls', value: '1', target: '2', pacing: 200 },
    ],
  },
  plumbing: {
    pacing: {
      today: { current: 14200, target: 5000 },
      week: { current: 14200, target: 35000 },
      month: { current: 85000, target: 109000 },
      year: { current: 85000, target: 1308000 },
    },
    kpis: [
      { name: 'Sales', value: '$14,200', target: '$15,000', pacing: 95 },
      { name: 'Revenue', value: '$13,500', target: '$12,000', pacing: 113 },
      { name: 'Jobs Converted', value: '7', target: '8', pacing: 88 },
      { name: 'Jobs Ran', value: '11', target: '12', pacing: 92 },
      { name: 'Average Ticket', value: '$382', target: '$350', pacing: 109 },
      { name: 'Conversion Rate', value: '63.6%', target: '65%', pacing: 98 },
    ],
  },
};

function getStatusColor(pacing: number): string {
  if (pacing >= 100) return 'var(--christmas-green)';
  if (pacing >= 90) return '#3B82F6';
  if (pacing >= 75) return 'var(--christmas-gold)';
  return '#EF4444';
}

export default function DepartmentPage() {
  const params = useParams();
  const dept = params.dept as string;

  const departmentName = departmentNames[dept] || 'Department';
  const data = mockDepartmentData[dept] || mockDepartmentData['christmas'];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--christmas-cream)' }}
        >
          {departmentName}
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Department KPIs and goal tracking
        </p>
      </div>

      {/* Pacing Section */}
      <div className="mb-8">
        <PacingSection data={data.pacing} title={`${departmentName} Pacing`} />
      </div>

      {/* KPIs Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div
          className="flex items-center gap-3 p-5 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
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
            Key Performance Indicators
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                <th
                  className="text-left text-xs font-semibold uppercase tracking-wider px-5 py-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  KPI
                </th>
                <th
                  className="text-right text-xs font-semibold uppercase tracking-wider px-5 py-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Actual
                </th>
                <th
                  className="text-right text-xs font-semibold uppercase tracking-wider px-5 py-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Target
                </th>
                <th
                  className="text-right text-xs font-semibold uppercase tracking-wider px-5 py-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  % to Goal
                </th>
              </tr>
            </thead>
            <tbody>
              {data.kpis.map((kpi, index) => (
                <tr
                  key={kpi.name}
                  style={{
                    borderBottom:
                      index < data.kpis.length - 1
                        ? '1px solid var(--border-subtle)'
                        : 'none',
                  }}
                >
                  <td className="px-5 py-4">
                    <span
                      className="font-medium"
                      style={{ color: 'var(--christmas-cream)' }}
                    >
                      {kpi.name}
                    </span>
                  </td>
                  <td
                    className="text-right px-5 py-4 font-medium"
                    style={{ color: 'var(--christmas-cream)' }}
                  >
                    {kpi.value}
                  </td>
                  <td
                    className="text-right px-5 py-4"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {kpi.target}
                  </td>
                  <td
                    className="text-right px-5 py-4 font-semibold"
                    style={{ color: getStatusColor(kpi.pacing) }}
                  >
                    {kpi.pacing}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
