'use client';

import { DollarSign, TrendingUp, PieChart, Target, Users, Zap } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';
import { DateRangePreset } from '@/types';

// Get a short label for the date range preset
function getDateRangeLabel(preset: DateRangePreset): string {
  const labels: Record<DateRangePreset, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    thisWeek: 'This Week',
    weekToDate: 'WTD',
    last7: 'Last 7 Days',
    last14: 'Last 14 Days',
    last30: 'Last 30 Days',
    mtd: 'MTD',
    lastMonth: 'Last Month',
    last90: 'Last 90 Days',
    thisQuarter: 'This Quarter',
    lastQuarter: 'Last Quarter',
    quarterToDate: 'QTD',
    ytd: 'YTD',
    last365: 'Last 365 Days',
    lastYear: 'Last Year',
    custom: 'Custom',
  };
  return labels[preset] || 'Period';
}

export function KPICards() {
  const { getKPIs, dateRange } = useDashboardStore();
  const kpis = getKPIs();
  const periodLabel = getDateRangeLabel(dateRange.preset);

  const cards = [
    {
      label: `Total Sales ${periodLabel}`,
      value: formatCurrency(kpis.totalSalesMTD),
      icon: DollarSign,
      color: 'text-green-sales',
      bgColor: 'bg-green-sales/10',
    },
    {
      label: `Gross Margin ${periodLabel}`,
      value: formatCurrency(kpis.grossMarginMTD),
      subValue: `${kpis.grossMarginPercent.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-forest',
      bgColor: 'bg-forest/10',
    },
    {
      label: 'Pipeline Value',
      value: formatCurrency(kpis.pipelineValue),
      icon: PieChart,
      color: 'text-tan',
      bgColor: 'bg-tan/10',
    },
    {
      label: `Closing Rate ${periodLabel}`,
      value: `${kpis.avgClosingRate.toFixed(1)}%`,
      icon: Target,
      color: 'text-sage',
      bgColor: 'bg-sage/10',
    },
    {
      label: `Active Leads ${periodLabel}`,
      value: kpis.activeLeads.toString(),
      subValue: `+${kpis.newLeadsToday} today`,
      icon: Users,
      color: 'text-sage',
      bgColor: 'bg-sage/10',
    },
    {
      label: 'Sold Today',
      value: kpis.soldToday.toString(),
      icon: Zap,
      color: 'text-green-sales',
      bgColor: 'bg-green-sales/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="kpi-card animate-fade-in">
            <div className={`w-10 h-10 rounded-lg ${card.bgColor} flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
              {card.label}
            </p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            {card.subValue && (
              <p className="text-xs text-muted-foreground mt-1">{card.subValue}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
