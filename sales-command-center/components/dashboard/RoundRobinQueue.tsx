'use client';

import { Users, Flame, Megaphone, TrendingUp } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { cn } from '@/lib/utils';

export function RoundRobinQueue() {
  const { advisors } = useDashboardStore();

  // All active advisors (for performance tracking)
  const activeAdvisors = advisors.filter(a => a.active);

  // Only advisors in the queue (for round-robin display)
  const inQueueAdvisors = advisors.filter(a => a.active && a.inQueue);
  const sortedByTGL = [...inQueueAdvisors].sort((a, b) => a.tglQueuePosition - b.tglQueuePosition);
  const sortedByMarketed = [...inQueueAdvisors].sort((a, b) => a.marketedQueuePosition - b.marketedQueuePosition);

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-sage/20 flex items-center justify-center">
          <Users className="w-5 h-5 text-sage" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Round Robin Queue</h3>
          <p className="text-sm text-muted-foreground">Advisor assignment order</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TGL Queue */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-tan" />
            <span className="text-sm font-medium text-muted-foreground">TGL Queue</span>
          </div>
          <div className="space-y-2">
            {sortedByTGL.map((advisor, index) => (
              <div
                key={advisor.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-all',
                  index === 0
                    ? 'bg-tan/20 border border-tan/30'
                    : 'bg-muted/30'
                )}
              >
                <div
                  className={cn(
                    'queue-indicator text-white font-bold',
                    index === 0 ? 'bg-tan' : 'bg-muted-foreground/30'
                  )}
                >
                  {advisor.tglQueuePosition}
                </div>
                <div className="flex-1">
                  <p className={cn(
                    'font-medium',
                    index === 0 ? 'text-tan' : 'text-foreground'
                  )}>
                    {advisor.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {advisor.closingRate}% close rate
                  </p>
                </div>
                {index === 0 && (
                  <span className="text-xs font-medium text-tan uppercase">Next</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Marketed Queue */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="w-4 h-4 text-forest" />
            <span className="text-sm font-medium text-muted-foreground">Marketed Queue</span>
          </div>
          <div className="space-y-2">
            {sortedByMarketed.map((advisor, index) => (
              <div
                key={advisor.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-all',
                  index === 0
                    ? 'bg-forest/20 border border-forest/30'
                    : 'bg-muted/30'
                )}
              >
                <div
                  className={cn(
                    'queue-indicator text-white font-bold',
                    index === 0 ? 'bg-forest' : 'bg-muted-foreground/30'
                  )}
                >
                  {advisor.marketedQueuePosition}
                </div>
                <div className="flex-1">
                  <p className={cn(
                    'font-medium',
                    index === 0 ? 'text-forest' : 'text-foreground'
                  )}>
                    {advisor.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {advisor.closingRate}% close rate
                  </p>
                </div>
                {index === 0 && (
                  <span className="text-xs font-medium text-forest uppercase">Next</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Advisor Stats */}
      <div className="mt-6 pt-6 border-t border-border">
        <h4 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Advisor Performance MTD
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {activeAdvisors.map((advisor) => (
            <div key={advisor.id} className="bg-muted/30 rounded-lg p-3">
              <p className="font-medium text-foreground text-sm">{advisor.name}</p>
              <p className="text-green-sales font-bold mt-1">
                ${advisor.salesMTD.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {advisor.soldLeads}/{advisor.totalLeads} sold
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
