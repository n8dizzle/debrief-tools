'use client';

interface SourceMetrics {
  source: string;
  sourceDetail: string | null;
  leads: number;
  qualified: number;
  booked: number;
  completed: number;
  revenue: number;
  cost: number;
  cpa: number;
  bookingRate: number;
  closeRate: number;
  roi: number;
}

interface LeadsSourceTableProps {
  data: SourceMetrics[];
  type: 'source' | 'trade';
  isLoading?: boolean;
}

const sourceIcons: Record<string, { icon: string; color: string; bg: string }> = {
  lsa: { icon: 'G', color: '#4285F4', bg: '#4285F4/20' },
  gbp: { icon: 'G', color: '#34A853', bg: '#34A853/20' },
  organic: { icon: 'O', color: '#8B5CF6', bg: '#8B5CF6/20' },
  direct: { icon: 'D', color: '#6B7280', bg: '#6B7280/20' },
  website: { icon: 'W', color: '#3B82F6', bg: '#3B82F6/20' },
  angi: { icon: 'A', color: '#FF5722', bg: '#FF5722/20' },
  thumbtack: { icon: 'T', color: '#009FD4', bg: '#009FD4/20' },
  networx: { icon: 'N', color: '#FF9800', bg: '#FF9800/20' },
  yelp: { icon: 'Y', color: '#D32323', bg: '#D32323/20' },
  st_call: { icon: 'ST', color: '#00BFA5', bg: '#00BFA5/20' },
  st_booking: { icon: 'ST', color: '#00BFA5', bg: '#00BFA5/20' },
  HVAC: { icon: 'H', color: '#6eb887', bg: '#346643/30' },
  Plumbing: { icon: 'P', color: '#B8956B', bg: '#B8956B/30' },
  Other: { icon: '?', color: '#6B7280', bg: '#6B7280/20' },
  Unknown: { icon: '?', color: '#6B7280', bg: '#6B7280/20' },
};

const sourceLabels: Record<string, string> = {
  lsa: 'Google LSA',
  gbp: 'Google Business Profile',
  organic: 'Organic / Direct',
  direct: 'Direct',
  website: 'Website',
  angi: 'Angi',
  thumbtack: 'Thumbtack',
  networx: 'Networx',
  yelp: 'Yelp',
  st_call: 'ServiceTitan Call',
  st_booking: 'Online Booking',
  HVAC: 'HVAC',
  Plumbing: 'Plumbing',
  Other: 'Other',
  Unknown: 'Unknown',
};

export function LeadsSourceTable({ data, type, isLoading }: LeadsSourceTableProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyDecimal = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercent = (num: number) => `${num.toFixed(1)}%`;

  const getSourceIcon = (source: string) => {
    const config = sourceIcons[source] || sourceIcons.Unknown;
    return config;
  };

  if (isLoading) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            Performance by {type === 'source' ? 'Source' : 'Trade'}
          </h3>
        </div>
        <div className="animate-pulse p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-[#2a3e2a] rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {type === 'source' ? 'Source' : 'Trade'}
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Leads
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Booked
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Sold
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Cost
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Revenue
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                ROI
              </th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  No data available
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const iconConfig = getSourceIcon(row.source);
                return (
                  <tr
                    key={row.source}
                    className="transition-colors hover:bg-[#0d1f0d]"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: iconConfig.bg, color: iconConfig.color }}
                        >
                          {iconConfig.icon}
                        </div>
                        <div>
                          <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                            {sourceLabels[row.source] || row.source}
                          </div>
                          {row.sourceDetail && row.sourceDetail !== sourceLabels[row.source] && (
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {row.sourceDetail}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium" style={{ color: 'var(--christmas-cream)' }}>
                      {formatNumber(row.leads)}
                    </td>
                    <td className="py-3 px-4 text-right" style={{ color: 'var(--text-secondary)' }}>
                      {formatNumber(row.booked)}
                      <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                        ({formatPercent(row.bookingRate)})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right" style={{ color: 'var(--text-secondary)' }}>
                      {formatNumber(row.completed)}
                    </td>
                    <td className="py-3 px-4 text-right" style={{ color: 'var(--text-secondary)' }}>
                      {row.cost > 0 ? formatCurrency(row.cost) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium" style={{ color: '#22c55e' }}>
                      {row.revenue > 0 ? formatCurrency(row.revenue) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {row.cost > 0 ? (
                        <span style={{ color: row.roi > 0 ? '#22c55e' : row.roi < 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                          {row.roi > 0 ? '+' : ''}{formatPercent(row.roi)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
