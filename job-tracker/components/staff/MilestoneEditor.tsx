'use client';

import { useState } from 'react';
import { TrackerMilestone, MilestoneStatus, Trade } from '@/lib/supabase';

interface MilestoneEditorProps {
  milestones: TrackerMilestone[];
  trade: Trade;
  onUpdate: (milestoneId: string, status: MilestoneStatus, customerNotes?: string) => Promise<void>;
  disabled?: boolean;
}

export default function MilestoneEditor({ milestones, trade, onUpdate, disabled }: MilestoneEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const sortedMilestones = [...milestones].sort((a, b) => a.sort_order - b.sort_order);
  const tradeColor = trade === 'hvac' ? 'christmas-green' : 'christmas-gold';

  function getStatusColor(status: MilestoneStatus) {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'in_progress':
        return 'bg-blue-500';
      case 'skipped':
        return 'bg-yellow-500';
      default:
        return 'bg-border-default';
    }
  }

  function getStatusIcon(status: MilestoneStatus) {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'in_progress':
        return (
          <svg className="w-4 h-4 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        );
      case 'skipped':
        return (
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        );
      default:
        return <span className="w-2 h-2 rounded-full bg-text-muted" />;
    }
  }

  async function handleStatusChange(milestoneId: string, newStatus: MilestoneStatus) {
    const customerNote = notes[milestoneId];
    await onUpdate(milestoneId, newStatus, customerNote);
    setExpandedId(null);
  }

  return (
    <div className="space-y-2">
      {sortedMilestones.map((milestone, index) => (
        <div
          key={milestone.id}
          className={`border rounded-lg transition-all ${
            expandedId === milestone.id ? 'border-' + tradeColor : 'border-border-subtle'
          }`}
        >
          {/* Milestone Header */}
          <button
            onClick={() => setExpandedId(expandedId === milestone.id ? null : milestone.id)}
            disabled={disabled}
            className="w-full flex items-center gap-3 p-3 text-left hover:bg-bg-card-hover rounded-lg disabled:opacity-50"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStatusColor(milestone.status)}`}>
              {getStatusIcon(milestone.status)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text-primary">{milestone.name}</span>
                {milestone.is_optional && (
                  <span className="text-xs text-text-muted">(Optional)</span>
                )}
              </div>
              {milestone.description && (
                <p className="text-sm text-text-muted truncate">{milestone.description}</p>
              )}
            </div>
            <span className={`text-xs capitalize px-2 py-1 rounded ${
              milestone.status === 'completed' ? 'bg-green-500/20 text-green-400' :
              milestone.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
              milestone.status === 'skipped' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-border-subtle text-text-muted'
            }`}>
              {milestone.status.replace('_', ' ')}
            </span>
            <svg
              className={`w-5 h-5 text-text-muted transition-transform ${expandedId === milestone.id ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Expanded Content */}
          {expandedId === milestone.id && (
            <div className="px-3 pb-3 pt-1 border-t border-border-subtle">
              <div className="space-y-3">
                {/* Status Actions */}
                <div>
                  <label className="text-xs text-text-muted block mb-2">Update Status</label>
                  <div className="flex flex-wrap gap-2">
                    {(['pending', 'in_progress', 'completed', 'skipped'] as MilestoneStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(milestone.id, s)}
                        disabled={disabled || milestone.status === s}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          milestone.status === s
                            ? 'bg-' + tradeColor + ' text-white'
                            : 'bg-bg-card hover:bg-bg-card-hover text-text-secondary border border-border-subtle'
                        } disabled:opacity-50`}
                      >
                        {s.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer Notes */}
                <div>
                  <label className="text-xs text-text-muted block mb-2">
                    Customer-Visible Note (optional)
                  </label>
                  <textarea
                    value={notes[milestone.id] || milestone.customer_notes || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [milestone.id]: e.target.value }))}
                    placeholder="Add a note that the customer will see..."
                    className="input text-sm min-h-[60px]"
                    disabled={disabled}
                  />
                </div>

                {/* Metadata */}
                {milestone.completed_at && (
                  <p className="text-xs text-text-muted">
                    Completed: {new Date(milestone.completed_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
