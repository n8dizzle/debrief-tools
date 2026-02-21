'use client';

import { DollarSign, Users, TrendingUp, Award } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';

export function CommissionView() {
  const { leads, advisors } = useDashboardStore();

  const soldLeads = leads.filter(l => l.status === 'Sold' || l.status === 'Install Scheduled' || l.status === 'Completed');

  // Calculate commission (example: 3% of gross margin)
  const commissionRate = 0.03;

  const advisorCommissions = advisors.map(advisor => {
    const advisorLeads = soldLeads.filter(l => l.assignedAdvisor === advisor.name);
    const totalGM = advisorLeads.reduce((sum, l) => sum + l.grossMarginDollar, 0);
    const commission = totalGM * commissionRate;
    return {
      ...advisor,
      totalGM,
      commission,
      dealCount: advisorLeads.length,
    };
  }).sort((a, b) => b.commission - a.commission);

  const totalCommissions = advisorCommissions.reduce((sum, a) => sum + a.commission, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Commission Tracking</h2>
        <p className="text-muted-foreground">Advisor commission calculations (Admin Only)</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="kpi-card">
          <div className="w-10 h-10 rounded-lg bg-green-sales/10 flex items-center justify-center mb-3">
            <DollarSign className="w-5 h-5 text-green-sales" />
          </div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Total Commissions</p>
          <p className="text-2xl font-bold text-green-sales">{formatCurrency(totalCommissions)}</p>
          <p className="text-xs text-muted-foreground mt-1">Based on {commissionRate * 100}% of GM</p>
        </div>

        <div className="kpi-card">
          <div className="w-10 h-10 rounded-lg bg-sage/10 flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-sage" />
          </div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Active Advisors</p>
          <p className="text-2xl font-bold text-sage">{advisors.filter(a => a.active).length}</p>
        </div>

        <div className="kpi-card">
          <div className="w-10 h-10 rounded-lg bg-forest/10 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-forest" />
          </div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">Total Deals</p>
          <p className="text-2xl font-bold text-forest">{soldLeads.length}</p>
        </div>
      </div>

      {/* Commission Table */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Award className="w-5 h-5 text-sage" />
          <h3 className="text-lg font-semibold text-foreground">Commission Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Advisor</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Deals</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Total GM</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Commission</th>
              </tr>
            </thead>
            <tbody>
              {advisorCommissions.map((advisor, index) => (
                <tr key={advisor.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-500 text-black' :
                      index === 1 ? 'bg-gray-400 text-black' :
                      index === 2 ? 'bg-amber-600 text-white' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{advisor.name}</td>
                  <td className="px-4 py-3 text-right text-foreground">{advisor.dealCount}</td>
                  <td className="px-4 py-3 text-right text-forest font-medium">{formatCurrency(advisor.totalGM)}</td>
                  <td className="px-4 py-3 text-right text-green-sales font-bold">{formatCurrency(advisor.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {advisorCommissions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No commission data available
          </div>
        )}
      </div>
    </div>
  );
}
