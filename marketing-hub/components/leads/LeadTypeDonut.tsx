'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface LeadTypeData {
  type: string;
  count: number;
  percentage: number;
}

interface LeadTypeDonutProps {
  data: LeadTypeData[];
  totalLeads: number;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  call: { label: 'Phone Calls', color: '#60A5FA' },
  form: { label: 'Forms', color: '#34D399' },
  booking: { label: 'Online Bookings', color: '#A78BFA' },
  message: { label: 'Messages', color: '#FBBF24' },
  unknown: { label: 'Other', color: '#6B7280' },
};

export function LeadTypeDonut({ data, totalLeads }: LeadTypeDonutProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  };

  const formatPercent = (num: number) => `${num.toFixed(0)}%`;

  // Map data to include colors and labels
  const chartData = data.map((d) => ({
    ...d,
    label: typeConfig[d.type]?.label || d.type,
    color: typeConfig[d.type]?.color || '#6B7280',
  }));

  if (data.length === 0 || totalLeads === 0) {
    return (
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Lead Types
        </h3>
        <div className="h-60 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
        Lead Types
      </h3>

      <div className="flex items-center gap-6">
        {/* Donut Chart */}
        <div className="relative w-48 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={75}
                paddingAngle={2}
                dataKey="count"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a2e1a',
                  border: '1px solid #2a3e2a',
                  borderRadius: '8px',
                  color: '#E8DFC4',
                }}
                formatter={(value, name) => [typeof value === 'number' ? formatNumber(value) : String(value), name]}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {formatNumber(totalLeads)}
            </span>
            <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Total Leads
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-3">
          {chartData.map((item) => (
            <div key={item.type} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm" style={{ color: 'var(--christmas-cream)' }}>
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
                  {formatNumber(item.count)}
                </span>
                <span className="text-xs w-10 text-right" style={{ color: 'var(--text-muted)' }}>
                  {formatPercent(item.percentage)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
