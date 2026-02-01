'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface DailyMetric {
  date: string;
  leads: number;
  qualified: number;
  booked: number;
  completed: number;
  revenue: number;
  cost: number;
}

interface LeadsPerformanceChartProps {
  data: DailyMetric[];
  isLoading?: boolean;
}

export function LeadsPerformanceChart({ data, isLoading }: LeadsPerformanceChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      dateFormatted: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Performance Chart
        </h3>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-4 w-32 bg-[#2a3e2a] rounded mb-2"></div>
            <div className="h-60 w-full bg-[#2a3e2a] rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
        Performance Chart
      </h3>

      {data.length === 0 ? (
        <div className="h-80 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
          No data available for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3e2a" vertical={false} />
            <XAxis
              dataKey="dateFormatted"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8a9a8a', fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8a9a8a', fontSize: 12 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8a9a8a', fontSize: 12 }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a2e1a',
                border: '1px solid #2a3e2a',
                borderRadius: '8px',
                color: '#E8DFC4',
              }}
              formatter={(value, name) => {
                if (name === 'Revenue' && typeof value === 'number') {
                  return [`$${value.toLocaleString()}`, name];
                }
                return [value, name];
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => <span style={{ color: '#E8DFC4', fontSize: '12px' }}>{value}</span>}
            />

            {/* Stacked bars for lead stages */}
            <Bar
              yAxisId="left"
              dataKey="completed"
              name="Sold Jobs"
              stackId="leads"
              fill="#22c55e"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              yAxisId="left"
              dataKey="booked"
              name="Booked"
              stackId="leads"
              fill="#60A5FA"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              yAxisId="left"
              dataKey="qualified"
              name="Qualified"
              stackId="leads"
              fill="#94A3B8"
              radius={[4, 4, 0, 0]}
            />

            {/* Line for total leads trend */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="leads"
              name="Total Leads"
              stroke="#E8DFC4"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
