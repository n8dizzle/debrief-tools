'use client';

interface FunnelStage {
  name: string;
  count: number;
  value: number;  // Percentage of total
  rate: number;   // Conversion rate from previous stage
  costPerLead: number;
}

interface LeadsFunnelProps {
  stages: FunnelStage[];
  totalRevenue: number;
  totalSpend: number;
}

export function LeadsFunnel({ stages, totalRevenue, totalSpend }: LeadsFunnelProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  };

  const formatCurrency = (amount: number) => {
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

  // Color gradient from top to bottom (light blue to dark blue like ST)
  const colors = [
    { bg: '#60A5FA', text: '#1E40AF' },  // light blue
    { bg: '#3B82F6', text: '#1E3A8A' },  // blue
    { bg: '#2563EB', text: '#FFFFFF' },  // medium blue
    { bg: '#1D4ED8', text: '#FFFFFF' },  // darker blue
    { bg: '#1E40AF', text: '#FFFFFF' },  // dark blue
  ];

  const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;

  if (!stages || stages.length === 0) {
    return (
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Sales Funnel
        </h3>
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
          No funnel data available
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <h3 className="text-lg font-semibold mb-6" style={{ color: 'var(--christmas-cream)' }}>
        Sales Funnel
      </h3>

      <div className="flex gap-8">
        {/* Funnel Visualization */}
        <div className="flex-1 flex flex-col items-center">
          {stages.map((stage, index) => {
            const color = colors[Math.min(index, colors.length - 1)];
            // Calculate width based on percentage (min 30% to keep readable)
            const width = Math.max(30, stage.value);
            // Calculate trapezoid shape
            const nextWidth = stages[index + 1] ? Math.max(30, stages[index + 1].value) : width * 0.8;

            return (
              <div key={stage.name} className="w-full flex flex-col items-center">
                {/* Stage bar */}
                <div
                  className="relative flex items-center justify-center py-3 transition-all duration-300"
                  style={{
                    width: `${width}%`,
                    backgroundColor: color.bg,
                    clipPath: index < stages.length - 1
                      ? `polygon(0 0, 100% 0, ${50 + (nextWidth / width) * 50}% 100%, ${50 - (nextWidth / width) * 50}% 100%)`
                      : 'none',
                    borderRadius: index === stages.length - 1 ? '0 0 8px 8px' : '0',
                    minHeight: '48px',
                  }}
                >
                  <div className="text-center z-10">
                    <span className="font-bold text-lg" style={{ color: color.text }}>
                      {formatNumber(stage.count)}
                    </span>
                  </div>
                </div>

                {/* Conversion rate arrow between stages */}
                {index < stages.length - 1 && (
                  <div className="flex items-center justify-center py-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    {formatPercent(stages[index + 1].rate)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Stage Labels */}
        <div className="w-48 flex flex-col justify-between py-2">
          {stages.map((stage, index) => (
            <div key={`label-${stage.name}`} className="flex flex-col">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors[Math.min(index, colors.length - 1)].bg }}
                />
                <span className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
                  {stage.name}
                </span>
              </div>
              <div className="ml-5 text-xs" style={{ color: 'var(--text-muted)' }}>
                {formatCurrencyDecimal(stage.costPerLead)}/lead
              </div>
              {index < stages.length - 1 && (
                <div className="h-6" /> // Spacer for the conversion arrow
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom metrics row */}
      <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="text-center">
          <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
            Contact → Booked
          </div>
          <div className="text-xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {stages.length >= 3 ? formatPercent((stages[2].count / stages[0].count) * 100) : '0%'}
          </div>
          <div className="text-xs" style={{ color: stages[2]?.count > 0 ? '#22c55e' : 'var(--text-muted)' }}>
            Booking Rate
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
            Booked → Sold
          </div>
          <div className="text-xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {stages.length >= 5 && stages[2].count > 0 ? formatPercent((stages[4].count / stages[2].count) * 100) : '0%'}
          </div>
          <div className="text-xs" style={{ color: stages[4]?.count > 0 ? '#22c55e' : 'var(--text-muted)' }}>
            Close Rate
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
            ROI
          </div>
          <div className="text-xl font-bold" style={{ color: roi > 0 ? '#22c55e' : roi < 0 ? '#ef4444' : 'var(--christmas-cream)' }}>
            {roi !== 0 ? formatPercent(roi) : '-'}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatCurrency(totalRevenue)} revenue
          </div>
        </div>
      </div>
    </div>
  );
}
