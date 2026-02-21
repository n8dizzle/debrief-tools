'use client';

import { useState, useEffect } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { LeadStatus, Lead } from '@/types';
import {
  Flame,
  Megaphone,
  GripVertical,
  X,
  MapPin,
  Phone,
  User,
  Wrench,
  DollarSign,
  FileText,
  Loader2,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import type { STEstimate } from '@/app/api/leads/[id]/estimates/route';

const pipelineStages: LeadStatus[] = [
  'New Lead',
  'Assigned',
  'Quoted',
  'Sold',
  'Install Scheduled',
  'Completed',
];

const stageColors: Record<LeadStatus, { bg: string; border: string; text: string }> = {
  'New Lead': { bg: 'bg-sage/10', border: 'border-sage/30', text: 'text-sage' },
  'Assigned': { bg: 'bg-forest/10', border: 'border-forest/30', text: 'text-forest' },
  'Quoted': { bg: 'bg-tan/10', border: 'border-tan/30', text: 'text-tan' },
  'Sold': { bg: 'bg-green-sales/10', border: 'border-green-sales/30', text: 'text-green-sales' },
  'Install Scheduled': { bg: 'bg-tan/10', border: 'border-tan/30', text: 'text-tan' },
  'Completed': { bg: 'bg-muted/20', border: 'border-border', text: 'text-muted-foreground' },
};

const estimateStatusColors: Record<string, string> = {
  Open: 'text-tan bg-tan/10 border-tan/30',
  Draft: 'text-muted-foreground bg-muted/20 border-border',
  Sold: 'text-green-sales bg-green-sales/10 border-green-sales/30',
  Dismissed: 'text-muted-foreground bg-muted/20 border-border',
  Expired: 'text-muted-foreground bg-muted/20 border-border',
};

// ── Lead Detail Modal ────────────────────────────────────────────────────────

function LeadDetailModal({
  lead,
  onClose,
}: {
  lead: Lead;
  onClose: () => void;
}) {
  const [estimates, setEstimates] = useState<STEstimate[] | null>(null);
  const [loadingEstimates, setLoadingEstimates] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  // Fetch estimates when modal opens
  useEffect(() => {
    if (!lead.serviceTitanId) return;
    setLoadingEstimates(true);
    fetch(`/api/leads/${lead.id}/estimates`)
      .then((r) => r.json())
      .then((data) => {
        setEstimates(data.estimates ?? []);
        setEstimateError(data.error ?? null);
      })
      .catch(() => setEstimateError('Failed to load estimates'))
      .finally(() => setLoadingEstimates(false));
  }, [lead.id, lead.serviceTitanId]);

  const statusColors = stageColors[lead.status];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {lead.leadType === 'TGL' ? (
                <Flame className="w-4 h-4 text-tan flex-shrink-0" />
              ) : (
                <Megaphone className="w-4 h-4 text-forest flex-shrink-0" />
              )}
              <span
                className={cn(
                  'text-xs font-semibold uppercase tracking-wider',
                  lead.leadType === 'TGL' ? 'text-tan' : 'text-forest'
                )}
              >
                {lead.leadType === 'TGL' ? 'Tech Generated Lead' : 'Marketed Lead'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-foreground truncate">{lead.clientName}</h2>
            <span
              className={cn(
                'inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full border',
                statusColors.text,
                statusColors.bg,
                statusColors.border
              )}
            >
              {lead.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors ml-4 flex-shrink-0"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">

          {/* Contact & Location */}
          <div className="space-y-3">
            {lead.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <a
                  href={`tel:${lead.phone}`}
                  className="text-foreground hover:text-primary transition-colors"
                >
                  {lead.phone}
                </a>
              </div>
            )}
            {lead.address && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="text-foreground">{lead.address}</span>
              </div>
            )}
          </div>

          {/* Assignment */}
          <div className="rounded-lg bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Assigned Advisor</p>
                <p className="text-sm font-medium text-foreground">
                  {lead.assignedAdvisor || '—'}
                </p>
              </div>
            </div>

            {/* TGL: show technician */}
            {lead.leadType === 'TGL' && (
              <div className="flex items-center gap-3">
                <Wrench className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Technician (TGL)</p>
                  <p className="text-sm font-medium text-tan">
                    {lead.techName || '—'}
                  </p>
                </div>
              </div>
            )}

            {/* Source */}
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Source</p>
                <p className="text-sm font-medium text-foreground">{lead.source || '—'}</p>
              </div>
            </div>
          </div>

          {/* Estimates */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Estimates
                {estimates && estimates.length > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                    ({estimates.length})
                  </span>
                )}
              </h3>
            </div>

            {!lead.serviceTitanId ? (
              <p className="text-sm text-muted-foreground italic">
                No Service Titan job linked
              </p>
            ) : loadingEstimates ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading estimates...
              </div>
            ) : estimateError ? (
              <p className="text-sm text-red-400">{estimateError}</p>
            ) : estimates && estimates.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No estimates yet</p>
            ) : (
              <div className="space-y-2">
                {estimates?.map((est) => (
                  <div
                    key={est.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{est.name}</p>
                      {est.soldOn && (
                        <p className="text-xs text-muted-foreground">
                          Sold {new Date(est.soldOn).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full border font-medium',
                          estimateStatusColors[est.status] ?? 'text-muted-foreground bg-muted/20 border-border'
                        )}
                      >
                        {est.status}
                      </span>
                      <span className="text-sm font-bold text-green-sales">
                        {formatCurrency(est.total)}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Totals row */}
                {estimates && estimates.length > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-border mt-2">
                    <span className="text-xs text-muted-foreground">
                      {estimates.filter((e) => e.status === 'Sold').length} sold of {estimates.length}
                    </span>
                    <span className="text-sm font-bold text-green-sales">
                      {formatCurrency(
                        estimates
                          .filter((e) => e.status === 'Sold')
                          .reduce((sum, e) => sum + e.total, 0)
                      )}{' '}
                      <span className="text-xs font-normal text-muted-foreground">sold</span>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ST Job link */}
          {lead.serviceTitanId && (
            <a
              href={`https://go.servicetitan.com/#/Job/${lead.serviceTitanId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-2"
            >
              View Job #{lead.serviceTitanId} in Service Titan →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Draggable lead card ──────────────────────────────────────────────────────

function DraggableLeadCard({
  lead,
  onOpenDetail,
}: {
  lead: Lead;
  onOpenDetail: (lead: Lead) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'glass-card p-3 hover:border-primary/30 transition-all group',
        isDragging && 'opacity-50'
      )}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <div
          className="cursor-grab active:cursor-grabbing mt-0.5 flex-shrink-0"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </div>

        {/* Card content — clickable to open detail */}
        <button
          className="flex-1 min-w-0 text-left"
          onClick={() => onOpenDetail(lead)}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="font-medium text-foreground text-sm truncate">{lead.clientName}</p>
            {lead.leadType === 'TGL' ? (
              <Flame className="w-3.5 h-3.5 text-tan flex-shrink-0" />
            ) : (
              <Megaphone className="w-3.5 h-3.5 text-forest flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {lead.assignedAdvisor || 'Unassigned'}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-green-sales">
              {formatCurrency(lead.estimatedValue)}
            </span>
            <span className="text-xs text-forest">{lead.grossMarginPercent}% GM</span>
          </div>
        </button>
      </div>
    </div>
  );
}

// ── Droppable column ─────────────────────────────────────────────────────────

function DroppableColumn({
  stage,
  children,
}: {
  stage: LeadStatus;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, data: { stage } });
  const colors = stageColors[stage];

  return (
    <div ref={setNodeRef} className="flex-shrink-0 w-[280px]">
      <div
        className={cn(
          'pipeline-column transition-all',
          colors.bg,
          colors.border,
          isOver && 'ring-2 ring-sage ring-offset-2 ring-offset-background'
        )}
      >
        {children}
      </div>
    </div>
  );
}

// ── Drag overlay card ────────────────────────────────────────────────────────

function DragOverlayCard({ lead }: { lead: Lead }) {
  return (
    <div className="glass-card p-3 cursor-grabbing w-[260px] shadow-2xl rotate-3 opacity-90">
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="font-medium text-foreground text-sm truncate">{lead.clientName}</p>
            {lead.leadType === 'TGL' ? (
              <Flame className="w-3.5 h-3.5 text-tan flex-shrink-0" />
            ) : (
              <Megaphone className="w-3.5 h-3.5 text-forest flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {lead.assignedAdvisor || 'Unassigned'}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-green-sales">
              {formatCurrency(lead.estimatedValue)}
            </span>
            <span className="text-xs text-forest">{lead.grossMarginPercent}% GM</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main PipelineView ────────────────────────────────────────────────────────

export function PipelineView() {
  const { leads, updateLeadStatus, addToast } = useDashboardStore();
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const getLeadsForStage = (stage: LeadStatus) =>
    leads.filter((lead) => lead.status === stage);

  const getTotalValue = (stage: LeadStatus) =>
    getLeadsForStage(stage).reduce((sum, lead) => sum + lead.estimatedValue, 0);

  const handleDragStart = (event: DragStartEvent) => {
    const lead = event.active.data.current?.lead as Lead | undefined;
    if (lead) setActiveLead(lead);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);
    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as LeadStatus;
    const lead = leads.find((l) => l.id === leadId);

    if (lead && lead.status !== newStatus) {
      updateLeadStatus(leadId, newStatus);
      addToast({ type: 'success', message: `Moved "${lead.clientName}" to ${newStatus}` });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Sales Pipeline</h2>
        <p className="text-muted-foreground">
          Click a card for details · Drag to change status
        </p>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {pipelineStages.map((stage) => {
            const stageLeads = getLeadsForStage(stage);
            const totalValue = getTotalValue(stage);
            const colors = stageColors[stage];

            return (
              <DroppableColumn key={stage} stage={stage}>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={cn('font-semibold', colors.text)}>{stage}</h3>
                    <span className={cn('text-sm font-medium', colors.text)}>
                      {stageLeads.length}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(totalValue)} pipeline
                  </p>
                </div>

                <div className="space-y-3">
                  {stageLeads.map((lead) => (
                    <DraggableLeadCard
                      key={lead.id}
                      lead={lead}
                      onOpenDetail={setSelectedLead}
                    />
                  ))}
                </div>

                {stageLeads.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed border-border/50 rounded-lg">
                    Drop leads here
                  </div>
                )}
              </DroppableColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeLead ? <DragOverlayCard lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Lead detail modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </div>
  );
}
