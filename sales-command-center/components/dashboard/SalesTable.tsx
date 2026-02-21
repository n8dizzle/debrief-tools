'use client';

import { useDashboardStore } from '@/store/dashboardStore';
import { formatCurrency } from '@/lib/utils';

export function SalesTable() {
  const { advisors, dateRange } = useDashboardStore();

  // Sort by total sales descending
  const sortedAdvisors = [...advisors]
    .filter(a => a.active)
    .sort((a, b) => b.salesMTD - a.salesMTD);

  // Calculate totals
  const totals = sortedAdvisors.reduce(
    (acc, advisor) => ({
      totalSales: acc.totalSales + advisor.salesMTD,
      salesOpps: acc.salesOpps + advisor.salesOpps,
      soldCount: acc.soldCount + advisor.soldLeads,
    }),
    { totalSales: 0, salesOpps: 0, soldCount: 0 }
  );

  const overallAvgSale = totals.soldCount > 0 ? totals.totalSales / totals.soldCount : 0;
  const overallCloseRate = totals.salesOpps > 0 ? (totals.soldCount / totals.salesOpps) * 100 : 0;

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Sales Performance</h3>
        <p className="text-sm text-muted-foreground">
          {dateRange.startDate.toLocaleDateString()} - {dateRange.endDate.toLocaleDateString()}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Sales
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Average Sale
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Close Rate
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Sales Opps
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Sold
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedAdvisors.map((advisor) => (
              <tr key={advisor.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-sage/20 flex items-center justify-center mr-3">
                      <span className="text-sage font-medium text-sm">
                        {advisor.name.charAt(0)}
                      </span>
                    </div>
                    <span className="text-foreground font-medium">{advisor.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-green-sales font-semibold">
                    {formatCurrency(advisor.salesMTD)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-foreground">
                  {formatCurrency(advisor.averageSale)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className={`font-medium ${advisor.closingRate >= 50 ? 'text-green-sales' : advisor.closingRate >= 30 ? 'text-tan' : 'text-muted-foreground'}`}>
                    {advisor.closingRate.toFixed(1)}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-foreground">
                  {advisor.salesOpps}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-foreground">
                  {advisor.soldLeads}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/30 border-t-2 border-border">
            <tr className="font-semibold">
              <td className="px-6 py-4 text-foreground">Total</td>
              <td className="px-6 py-4 text-right text-green-sales">
                {formatCurrency(totals.totalSales)}
              </td>
              <td className="px-6 py-4 text-right text-foreground">
                {formatCurrency(overallAvgSale)}
              </td>
              <td className="px-6 py-4 text-right text-foreground">
                {overallCloseRate.toFixed(1)}%
              </td>
              <td className="px-6 py-4 text-right text-foreground">
                {totals.salesOpps}
              </td>
              <td className="px-6 py-4 text-right text-foreground">
                {totals.soldCount}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
