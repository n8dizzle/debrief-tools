'use client';

import { TrendingUp, DollarSign, Percent, Target } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';

export function MarginView() {
  const { leads, advisors } = useDashboardStore();

  const soldLeads = leads.filter(l => l.status === 'Sold' || l.status === 'Install Scheduled' || l.status === 'Completed');
  const totalRevenue = soldLeads.reduce((sum, l) => sum + l.estimatedValue, 0);
  const totalGM = soldLeads.reduce((sum, l) => sum + l.grossMarginDollar, 0);
  const avgGMPercent = soldLeads.length > 0
    ? soldLeads.reduce((sum, l) => sum + l.grossMarginPercent, 0) / soldLeads.length
    : 0;

  // Group by advisor
  const advisorStats = advisors.map(advisor => {
    const advisorLeads = soldLeads.filter(l => l.assignedAdvisor === advisor.name);
    const revenue = advisorLeads.reduce((sum, l) => sum + l.estimatedValue, 0);
    const margin = advisorLeads.reduce((sum, l) => sum + l.grossMarginDollar, 0);
    const avgMargin = advisorLeads.length > 0
      ? advisorLeads.reduce((sum, l) => sum + l.grossMarginPercent, 0) / advisorLeads.length
      : 0;
    return {
      ...advisor,
      revenue,
      margin,
      avgMargin,
      dealCount: advisorLeads.length,
    };
  }).filter(a => a.dealCount > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Margin Analysis</h2>
        <p className="text-muted-foreground">Gross margin performance tracking</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="w-10 h-10 rounded-lg bg-green-sales/10 flex items-center justify-center mb-3">
            <DollarSign className="w-5 h-5 text-green-sales" />
          </div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-green-sales">{formatCurrency(totalRevenue)}</p>
        </div>

        <div className="kpi-card">
          <div className="w-10 h-10 rounded-lg bg-forest/10 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-forest" />
          </div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Total Gross Margin</p>
          <p className="text-2xl font-bold text-forest">{formatCurrency(totalGM)}</p>
        </div>

        <div className="kpi-card">
          <div className="w-10 h-10 rounded-lg bg-forest/10 flex items-center justify-center mb-3">
            <Percent className="w-5 h-5 text-forest" />
          </div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Average GM %</p>
          <p className="text-2xl font-bold text-forest">{avgGMPercent.toFixed(1)}%</p>
        </div>

        <div className="kpi-card">
          <div className="w-10 h-10 rounded-lg bg-sage/10 flex items-center justify-center mb-3">
            <Target className="w-5 h-5 text-sage" />
          </div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Deals Closed</p>
          <p className="text-2xl font-bold text-sage">{soldLeads.length}</p>
        </div>
      </div>

      {/* By Advisor */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Margin by Advisor</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Advisor</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Deals</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Revenue</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">GM $</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Avg GM %</th>
              </tr>
            </thead>
            <tbody>
              {advisorStats.map(advisor => (
                <tr key={advisor.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{advisor.name}</td>
                  <td className="px-4 py-3 text-right text-foreground">{advisor.dealCount}</td>
                  <td className="px-4 py-3 text-right text-green-sales font-medium">{formatCurrency(advisor.revenue)}</td>
                  <td className="px-4 py-3 text-right text-forest font-medium">{formatCurrency(advisor.margin)}</td>
                  <td className="px-4 py-3 text-right text-forest">{advisor.avgMargin.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {advisorStats.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No sales data available
          </div>
        )}
      </div>
    </div>
  );
}
