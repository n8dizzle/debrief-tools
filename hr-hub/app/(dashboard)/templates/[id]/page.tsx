'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useHRPermissions } from '@/hooks/useHRPermissions';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/hr-utils';
import type { HRWorkflowTemplate, HRTemplatePhase, HRTemplateStep, ResponsibleRole } from '@/lib/supabase';

const ROLES: ResponsibleRole[] = ['recruiter', 'hiring_manager', 'leadership', 'hr', 'employee'];

export default function TemplateEditorPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;
  const { canManageTemplates } = useHRPermissions();

  const [template, setTemplate] = useState<HRWorkflowTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase accordion state
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  // Add phase form
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [newPhase, setNewPhase] = useState({ name: '', relative_start_day: 0, relative_end_day: 0 });
  const [addingPhase, setAddingPhase] = useState(false);

  // Add step form
  const [addingStepToPhase, setAddingStepToPhase] = useState<string | null>(null);
  const [newStep, setNewStep] = useState({
    title: '',
    description: '',
    guidance_text: '',
    responsible_role: 'hr' as ResponsibleRole,
    relative_due_day: 0,
    is_conditional: false,
    condition_label: '',
  });
  const [savingStep, setSavingStep] = useState(false);

  const loadTemplate = useCallback(async () => {
    try {
      const res = await fetch(`/api/templates/${templateId}`);
      if (!res.ok) throw new Error('Template not found');
      const data = await res.json();
      setTemplate(data);
      // Expand all phases by default
      if (data.phases) {
        setExpandedPhases(new Set(data.phases.map((p: HRTemplatePhase) => p.id)));
      }
    } catch (err) {
      console.error('Error loading template:', err);
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  const handleAddPhase = async () => {
    if (!newPhase.name.trim()) return;
    setAddingPhase(true);
    try {
      const existingPhases = template?.phases || [];
      const maxSort = existingPhases.reduce((max, p) => Math.max(max, p.sort_order), 0);

      const res = await fetch(`/api/templates/${templateId}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPhase.name,
          sort_order: maxSort + 1,
          relative_start_day: newPhase.relative_start_day,
          relative_end_day: newPhase.relative_end_day,
        }),
      });

      if (res.ok) {
        setNewPhase({ name: '', relative_start_day: 0, relative_end_day: 0 });
        setShowAddPhase(false);
        await loadTemplate();
      }
    } catch (err) {
      console.error('Error adding phase:', err);
    } finally {
      setAddingPhase(false);
    }
  };

  const handleAddStep = async (phaseId: string) => {
    if (!newStep.title.trim()) return;
    setSavingStep(true);
    try {
      const phase = template?.phases?.find((p) => p.id === phaseId);
      const existingSteps = phase?.steps || [];
      const maxSort = existingSteps.reduce((max, s) => Math.max(max, s.sort_order), 0);

      const res = await fetch(`/api/templates/${templateId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase_id: phaseId,
          title: newStep.title,
          description: newStep.description || null,
          guidance_text: newStep.guidance_text || null,
          responsible_role: newStep.responsible_role,
          relative_due_day: newStep.relative_due_day,
          is_conditional: newStep.is_conditional,
          condition_label: newStep.is_conditional ? newStep.condition_label || null : null,
          sort_order: maxSort + 1,
        }),
      });

      if (res.ok) {
        setNewStep({
          title: '',
          description: '',
          guidance_text: '',
          responsible_role: 'hr',
          relative_due_day: 0,
          is_conditional: false,
          condition_label: '',
        });
        setAddingStepToPhase(null);
        await loadTemplate();
      }
    } catch (err) {
      console.error('Error adding step:', err);
    } finally {
      setSavingStep(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--christmas-green)' }}
          />
          <p style={{ color: 'var(--text-muted)' }}>Loading template...</p>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--status-error)', marginBottom: '1rem' }}>{error || 'Template not found'}</p>
        <button className="btn btn-secondary" onClick={() => router.push('/templates')}>
          Back to Templates
        </button>
      </div>
    );
  }

  const phases = template.phases || [];

  return (
    <div>
      {/* Back link */}
      <button
        className="text-sm mb-4 flex items-center gap-1"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => router.push('/templates')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Templates
      </button>

      {/* Template Info */}
      <div className="card mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {template.name}
            </h1>
            {template.description && (
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {template.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className="badge"
              style={{
                backgroundColor: template.workflow_type === 'onboarding'
                  ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                color: template.workflow_type === 'onboarding' ? '#60a5fa' : '#c084fc',
              }}
            >
              {template.workflow_type === 'onboarding' ? 'Onboarding' : 'Offboarding'}
            </span>
            {template.is_base && (
              <span
                className="badge"
                style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }}
              >
                Base Template
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
          {template.portal_departments && (
            <span>Department: {template.portal_departments.name}</span>
          )}
          <span>{phases.length} phase{phases.length !== 1 ? 's' : ''}</span>
          <span>
            {phases.reduce((sum, p) => sum + (p.steps?.length || 0), 0)} step{phases.reduce((sum, p) => sum + (p.steps?.length || 0), 0) !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-4">
        {phases.map((phase) => {
          const isExpanded = expandedPhases.has(phase.id);
          const steps = phase.steps || [];

          return (
            <div key={phase.id} className="card" style={{ padding: 0 }}>
              {/* Phase header */}
              <button
                className="w-full px-4 py-3 flex items-center justify-between text-left"
                onClick={() => togglePhase(phase.id)}
              >
                <div className="flex items-center gap-3">
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="var(--text-muted)"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div>
                    <h3 className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                      {phase.name}
                    </h3>
                    {phase.description && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {phase.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>Day {phase.relative_start_day}–{phase.relative_end_day}</span>
                  <span>{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
                </div>
              </button>

              {/* Phase content */}
              {isExpanded && (
                <div
                  className="px-4 pb-4"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  {steps.length === 0 ? (
                    <p className="text-sm py-3" style={{ color: 'var(--text-muted)' }}>
                      No steps in this phase yet.
                    </p>
                  ) : (
                    <div className="space-y-2 mt-3">
                      {steps.map((step) => {
                        const roleColor = ROLE_COLORS[step.responsible_role];
                        return (
                          <div
                            key={step.id}
                            className="rounded-lg p-3"
                            style={{
                              backgroundColor: 'var(--bg-primary)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                                {step.title}
                              </span>
                              <span
                                className="badge text-[10px]"
                                style={{ backgroundColor: roleColor.bg, color: roleColor.text, border: `1px solid ${roleColor.border}` }}
                              >
                                {ROLE_LABELS[step.responsible_role]}
                              </span>
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Day {step.relative_due_day}
                              </span>
                              {step.is_conditional && (
                                <span
                                  className="badge text-[10px]"
                                  style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.2)' }}
                                >
                                  {step.condition_label || 'Conditional'}
                                </span>
                              )}
                            </div>
                            {step.description && (
                              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                {step.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Step */}
                  {canManageTemplates && addingStepToPhase !== phase.id && (
                    <button
                      className="mt-3 text-xs flex items-center gap-1"
                      style={{ color: 'var(--christmas-green-light)' }}
                      onClick={() => {
                        setAddingStepToPhase(phase.id);
                        setNewStep({
                          title: '',
                          description: '',
                          guidance_text: '',
                          responsible_role: 'hr',
                          relative_due_day: phase.relative_start_day,
                          is_conditional: false,
                          condition_label: '',
                        });
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Step
                    </button>
                  )}

                  {/* Add Step Form */}
                  {addingStepToPhase === phase.id && (
                    <div
                      className="mt-3 rounded-lg p-4 space-y-3"
                      style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-default)' }}
                    >
                      <h4 className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        Add Step to {phase.name}
                      </h4>
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Title *</label>
                        <input
                          className="input w-full"
                          value={newStep.title}
                          onChange={(e) => setNewStep({ ...newStep, title: e.target.value })}
                          placeholder="Step title"
                        />
                      </div>
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Description</label>
                        <textarea
                          className="input w-full"
                          value={newStep.description}
                          onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
                          rows={2}
                          placeholder="Optional description"
                        />
                      </div>
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Guidance Text</label>
                        <textarea
                          className="input w-full"
                          value={newStep.guidance_text}
                          onChange={(e) => setNewStep({ ...newStep, guidance_text: e.target.value })}
                          rows={2}
                          placeholder="Instructions for the person completing this step"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Responsible Role *</label>
                          <select
                            className="select w-full"
                            value={newStep.responsible_role}
                            onChange={(e) => setNewStep({ ...newStep, responsible_role: e.target.value as ResponsibleRole })}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Due Day (relative to start)</label>
                          <input
                            type="number"
                            className="input w-full"
                            value={newStep.relative_due_day}
                            onChange={(e) => setNewStep({ ...newStep, relative_due_day: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <input
                            type="checkbox"
                            checked={newStep.is_conditional}
                            onChange={(e) => setNewStep({ ...newStep, is_conditional: e.target.checked })}
                          />
                          Conditional step
                        </label>
                        {newStep.is_conditional && (
                          <input
                            className="input flex-1"
                            value={newStep.condition_label}
                            onChange={(e) => setNewStep({ ...newStep, condition_label: e.target.value })}
                            placeholder="Condition label (e.g., 'If relocating')"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          className="btn btn-primary text-sm"
                          onClick={() => handleAddStep(phase.id)}
                          disabled={savingStep || !newStep.title.trim()}
                        >
                          {savingStep ? 'Adding...' : 'Add Step'}
                        </button>
                        <button
                          className="btn btn-secondary text-sm"
                          onClick={() => setAddingStepToPhase(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Phase */}
      {canManageTemplates && (
        <div className="mt-4">
          {!showAddPhase ? (
            <button
              className="btn btn-secondary flex items-center gap-2"
              onClick={() => setShowAddPhase(true)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Phase
            </button>
          ) : (
            <div
              className="card space-y-3"
              style={{ border: '1px solid var(--border-default)' }}
            >
              <h4 className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
                Add Phase
              </h4>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Phase Name *</label>
                <input
                  className="input w-full"
                  value={newPhase.name}
                  onChange={(e) => setNewPhase({ ...newPhase, name: e.target.value })}
                  placeholder="e.g., Pre-boarding"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Start Day</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={newPhase.relative_start_day}
                    onChange={(e) => setNewPhase({ ...newPhase, relative_start_day: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>End Day</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={newPhase.relative_end_day}
                    onChange={(e) => setNewPhase({ ...newPhase, relative_end_day: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-primary text-sm"
                  onClick={handleAddPhase}
                  disabled={addingPhase || !newPhase.name.trim()}
                >
                  {addingPhase ? 'Adding...' : 'Add Phase'}
                </button>
                <button
                  className="btn btn-secondary text-sm"
                  onClick={() => setShowAddPhase(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
