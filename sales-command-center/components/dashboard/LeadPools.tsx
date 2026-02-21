'use client';

import { Flame, Megaphone, ArrowRight, Phone, MapPin } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';

export function LeadPools() {
  const { leads, advisors, assignLead } = useDashboardStore();

  const tglLeads = leads.filter(l => l.leadType === 'TGL' && l.status === 'New Lead');
  const marketedLeads = leads.filter(l => l.leadType === 'Marketed' && l.status === 'New Lead');

  const nextTGLAdvisor = advisors.find(a => a.tglQueuePosition === 1 && a.active);
  const nextMarketedAdvisor = advisors.find(a => a.marketedQueuePosition === 1 && a.active);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* TGL Lead Pool */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-tan/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-tan" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Tech Generated Leads</h3>
              <p className="text-sm text-muted-foreground">{tglLeads.length} new leads waiting</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-tan/20 text-tan border border-tan/30">
            TGL Pool
          </span>
        </div>

        {/* Next in Queue */}
        {nextTGLAdvisor && (
          <div className="bg-tan/10 rounded-lg p-3 mb-4 border border-tan/20">
            <p className="text-xs text-tan font-medium mb-1">NEXT IN QUEUE</p>
            <p className="text-foreground font-semibold">{nextTGLAdvisor.name}</p>
          </div>
        )}

        {/* Lead Cards */}
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {tglLeads.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No new TGL leads</p>
          ) : (
            tglLeads.map((lead) => (
              <div key={lead.id} className="lead-card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-foreground">{lead.clientName}</p>
                    <p className="text-sm text-muted-foreground">Tech: {lead.techName}</p>
                  </div>
                  <span className="text-green-sales font-bold">
                    ${lead.estimatedValue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {lead.phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {lead.source}
                  </span>
                </div>
                <button
                  onClick={() => assignLead(lead.id, 'TGL')}
                  className="w-full py-2 px-4 rounded-lg bg-tan hover:bg-tan/90 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  Assign to {nextTGLAdvisor?.name}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Marketed Lead Pool */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-forest/20 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-forest" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Marketed Leads</h3>
              <p className="text-sm text-muted-foreground">{marketedLeads.length} new leads waiting</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-forest/20 text-forest border border-forest/30">
            Marketed Pool
          </span>
        </div>

        {/* Next in Queue */}
        {nextMarketedAdvisor && (
          <div className="bg-forest/10 rounded-lg p-3 mb-4 border border-forest/20">
            <p className="text-xs text-forest font-medium mb-1">NEXT IN QUEUE</p>
            <p className="text-foreground font-semibold">{nextMarketedAdvisor.name}</p>
          </div>
        )}

        {/* Lead Cards */}
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {marketedLeads.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No new marketed leads</p>
          ) : (
            marketedLeads.map((lead) => (
              <div key={lead.id} className="lead-card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-foreground">{lead.clientName}</p>
                    <p className="text-sm text-muted-foreground">Source: {lead.source}</p>
                  </div>
                  <span className="text-green-sales font-bold">
                    ${lead.estimatedValue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {lead.phone}
                  </span>
                </div>
                <button
                  onClick={() => assignLead(lead.id, 'Marketed')}
                  className="w-full py-2 px-4 rounded-lg bg-forest hover:bg-forest/90 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  Assign to {nextMarketedAdvisor?.name}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
