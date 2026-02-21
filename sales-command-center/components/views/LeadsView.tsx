'use client';

import { useState } from 'react';
import { Search, Plus, Flame, Megaphone, X } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { LeadStatus, LeadType, MarketedLeadInput } from '@/types';
import { MarketedLeadForm } from '@/components/forms/MarketedLeadForm';

const statusColors: Record<LeadStatus, string> = {
  'New Lead': 'bg-sage/20 text-sage border-sage/30',
  'Assigned': 'bg-forest/20 text-forest border-forest/30',
  'Quoted': 'bg-tan/20 text-tan border-tan/30',
  'Sold': 'bg-green-sales/20 text-green-sales border-green-sales/30',
  'Install Scheduled': 'bg-tan/20 text-tan border-tan/30',
  'Completed': 'bg-muted text-muted-foreground border-border',
};

export function LeadsView() {
  const { leads, updateLeadStatus, addLead, addToast } = useDashboardStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddLead = async (data: MarketedLeadInput) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: data.customerName,
          leadType: 'Marketed',
          source: data.source,
          status: 'New Lead',
          phone: data.phone,
          address: data.address,
          notes: data.notes,
          unitAge: data.unitAge,
          systemType: data.systemType,
        }),
      });
      if (!response.ok) throw new Error('Failed to create lead');
      const { lead: newLead } = await response.json();
      addLead(newLead);
      setShowAddLeadModal(false);
      addToast({ type: 'success', message: `Lead "${data.customerName}" added successfully` });
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to add lead' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.assignedAdvisor?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesType = typeFilter === 'all' || lead.leadType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">All Leads</h2>
          <p className="text-muted-foreground">{leads.length} total leads in system</p>
        </div>
        <button
          onClick={() => setShowAddLeadModal(true)}
          className="px-4 py-2 rounded-lg bg-sage hover:bg-sage/90 text-white font-medium text-sm transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Lead
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search leads..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Status</option>
          <option value="New Lead">New Lead</option>
          <option value="Assigned">Assigned</option>
          <option value="Quoted">Quoted</option>
          <option value="Sold">Sold</option>
          <option value="Install Scheduled">Install Scheduled</option>
          <option value="Completed">Completed</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Types</option>
          <option value="TGL">TGL</option>
          <option value="Marketed">Marketed</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Client</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Source</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Advisor</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Value</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">GM %</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">GM $</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedLead(lead.id)}
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">{lead.clientName}</p>
                      <p className="text-xs text-muted-foreground">{lead.phone}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {lead.leadType === 'TGL' ? (
                        <Flame className="w-4 h-4 text-tan" />
                      ) : (
                        <Megaphone className="w-4 h-4 text-forest" />
                      )}
                      <span className={lead.leadType === 'TGL' ? 'text-tan' : 'text-forest'}>
                        {lead.leadType}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{lead.source}</td>
                  <td className="px-6 py-4">
                    <span className={cn('status-badge border', statusColors[lead.status])}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-foreground">
                    {lead.assignedAdvisor || '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-green-sales">
                    {formatCurrency(lead.estimatedValue)}
                  </td>
                  <td className="px-6 py-4 text-right text-forest">
                    {lead.grossMarginPercent}%
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-forest">
                    {formatCurrency(lead.grossMarginDollar)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLeads.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No leads found
          </div>
        )}
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setSelectedLead(null)}>
          <div className="glass-card p-6 max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()}>
            {(() => {
              const lead = leads.find(l => l.id === selectedLead);
              if (!lead) return null;
              return (
                <>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">{lead.clientName}</h3>
                      <p className="text-muted-foreground">{lead.phone}</p>
                    </div>
                    <button
                      onClick={() => setSelectedLead(null)}
                      className="text-muted-foreground hover:text-foreground text-2xl"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Type</label>
                      <p className="text-foreground">{lead.leadType}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Source</label>
                      <p className="text-foreground">{lead.source}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Address</label>
                      <p className="text-foreground">{lead.address || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Assigned To</label>
                      <p className="text-foreground">{lead.assignedAdvisor || 'Unassigned'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Value</label>
                      <p className="text-green-sales font-bold">{formatCurrency(lead.estimatedValue)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Gross Margin</label>
                      <p className="text-forest font-bold">{formatCurrency(lead.grossMarginDollar)} ({lead.grossMarginPercent}%)</p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm text-muted-foreground">Status</label>
                      <select
                        value={lead.status}
                        onChange={(e) => updateLeadStatus(lead.id, e.target.value as LeadStatus)}
                        className="w-full mt-1 px-4 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="New Lead">New Lead</option>
                        <option value="Assigned">Assigned</option>
                        <option value="Quoted">Quoted</option>
                        <option value="Sold">Sold</option>
                        <option value="Install Scheduled">Install Scheduled</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAddLeadModal(false)}>
          <div className="glass-card p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-foreground">Add New Lead</h3>
              <button
                onClick={() => setShowAddLeadModal(false)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <MarketedLeadForm onSubmit={handleAddLead} isSubmitting={isSubmitting} />
          </div>
        </div>
      )}
    </div>
  );
}
