'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface WorkflowStep {
  id: string;
  step_text: string;
  step_order: number;
  is_completed: boolean;
  improvement_note: string | null;
}

export default function WorkflowPage() {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [newStep, setNewStep] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const editRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const loadSteps = useCallback(async () => {
    try {
      const res = await fetch('/api/workflow');
      if (res.ok) setSteps(await res.json());
    } catch (err) {
      console.error('Failed to load workflow:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSteps(); }, [loadSteps]);

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (noteEditingId && noteRef.current) {
      noteRef.current.focus();
    }
  }, [noteEditingId]);

  const addStep = async () => {
    if (!newStep.trim()) return;
    const res = await fetch('/api/workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step_text: newStep }),
    });
    if (res.ok) {
      const step = await res.json();
      setSteps(prev => [...prev, step]);
      setNewStep('');
      inputRef.current?.focus();
    }
  };

  const updateStep = async (id: string, updates: Partial<WorkflowStep> & { improvement_note?: string | null }) => {
    const res = await fetch('/api/workflow', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSteps(prev => prev.map(s => s.id === id ? updated : s));
    }
  };

  const deleteStep = async (id: string) => {
    const res = await fetch('/api/workflow', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setSteps(prev => prev.filter(s => s.id !== id));
    }
  };

  const saveNote = () => {
    if (noteEditingId) {
      updateStep(noteEditingId, { improvement_note: noteText.trim() || null } as any);
    }
    setNoteEditingId(null);
  };

  const saveEdit = () => {
    if (editingId && editText.trim()) {
      updateStep(editingId, { step_text: editText.trim() });
    }
    setEditingId(null);
  };

  const moveStep = async (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= steps.length) return;
    const reordered = [...steps];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setSteps(reordered);

    await fetch('/api/workflow', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reorder: reordered.map(s => s.id) }),
    });
  };

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (dragIdx !== null && dragIdx !== idx) {
      moveStep(dragIdx, idx);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const completedCount = steps.filter(s => s.is_completed).length;
  const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Payroll Workflow
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Step-by-step checklist for running payroll. Drag to reorder.
        </p>
      </div>

      {/* Progress */}
      {steps.length > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Progress
            </span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {completedCount} of {steps.length} steps
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: progress === 100 ? 'var(--status-success)' : 'var(--christmas-green)',
              }}
            />
          </div>
          {progress === 100 && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-sm font-medium" style={{ color: 'var(--status-success)' }}>
                All steps complete!
              </p>
              <button
                onClick={() => {
                  steps.forEach(s => { if (s.is_completed) updateStep(s.id, { is_completed: false }); });
                }}
                className="text-xs px-3 py-1 rounded-full"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
              >
                Reset All
              </button>
            </div>
          )}
        </div>
      )}

      {/* Steps List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse">
              <div className="h-5 w-3/4 rounded" style={{ background: 'var(--border-subtle)' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step, idx) => (
            <div
              key={step.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
              className="card group transition-all"
              style={{
                padding: '0.75rem 1rem',
                opacity: dragIdx === idx ? 0.4 : 1,
                borderColor: dragOverIdx === idx ? 'var(--christmas-green)' : undefined,
                cursor: 'grab',
              }}
            >
              {/* Main row */}
              <div className="flex items-center gap-3">
                {/* Drag handle */}
                <div className="flex-shrink-0 opacity-30 group-hover:opacity-60 transition-opacity" style={{ color: 'var(--text-muted)' }}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                  </svg>
                </div>

                {/* Step number */}
                <span className="flex-shrink-0 text-xs font-mono w-6 text-center" style={{ color: 'var(--text-muted)' }}>
                  {idx + 1}
                </span>

                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={step.is_completed}
                  onChange={() => updateStep(step.id, { is_completed: !step.is_completed })}
                  className="flex-shrink-0"
                  style={{ accentColor: 'var(--christmas-green)', width: 18, height: 18 }}
                />

                {/* Text */}
                {editingId === step.id ? (
                  <input
                    ref={editRef}
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="flex-1 bg-transparent border-b outline-none text-sm py-0.5"
                    style={{ color: 'var(--text-primary)', borderColor: 'var(--christmas-green)' }}
                  />
                ) : (
                  <span
                    className="flex-1 text-sm cursor-text"
                    style={{
                      color: step.is_completed ? 'var(--text-muted)' : 'var(--text-primary)',
                      textDecoration: step.is_completed ? 'line-through' : 'none',
                    }}
                    onClick={() => {
                      setEditingId(step.id);
                      setEditText(step.step_text);
                    }}
                  >
                    {step.step_text}
                  </span>
                )}

                {/* Action buttons */}
                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Flag improvement */}
                  <button
                    onClick={() => {
                      setNoteEditingId(noteEditingId === step.id ? null : step.id);
                      setNoteText(step.improvement_note || '');
                    }}
                    className="p-1 rounded hover:bg-yellow-500/20"
                    style={{ color: step.improvement_note ? '#fcd34d' : 'var(--text-muted)' }}
                    title="Flag improvement opportunity"
                  >
                    <svg className="w-4 h-4" fill={step.improvement_note ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveStep(idx, idx - 1)}
                    disabled={idx === 0}
                    className="p-1 rounded hover:bg-white/10"
                    style={{ color: idx === 0 ? 'var(--border-subtle)' : 'var(--text-muted)' }}
                    title="Move up"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveStep(idx, idx + 1)}
                    disabled={idx === steps.length - 1}
                    className="p-1 rounded hover:bg-white/10"
                    style={{ color: idx === steps.length - 1 ? 'var(--border-subtle)' : 'var(--text-muted)' }}
                    title="Move down"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteStep(step.id)}
                    className="p-1 rounded hover:bg-red-500/20"
                    style={{ color: 'var(--text-muted)' }}
                    title="Delete step"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Improvement note — shown when exists or editing */}
              {(step.improvement_note || noteEditingId === step.id) && (
                <div
                  className="mt-2 ml-16 rounded-lg"
                  style={{
                    background: 'rgba(234, 179, 8, 0.08)',
                    border: '1px solid rgba(234, 179, 8, 0.2)',
                    padding: '0.5rem 0.75rem',
                  }}
                >
                  <div className="flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="#fcd34d" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    {noteEditingId === step.id ? (
                      <div className="flex-1">
                        <textarea
                          ref={noteRef}
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(); }
                            if (e.key === 'Escape') setNoteEditingId(null);
                          }}
                          placeholder="Describe the improvement opportunity..."
                          className="w-full bg-transparent outline-none text-xs resize-none"
                          style={{ color: '#fcd34d', minHeight: '2.5rem' }}
                          rows={2}
                        />
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={saveNote}
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#fcd34d' }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setNoteEditingId(null)}
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Cancel
                          </button>
                          {step.improvement_note && (
                            <button
                              onClick={() => { updateStep(step.id, { improvement_note: null } as any); setNoteEditingId(null); }}
                              className="text-xs px-2 py-0.5 rounded ml-auto"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span
                        className="text-xs cursor-pointer flex-1"
                        style={{ color: '#fcd34d', opacity: 0.9 }}
                        onClick={() => { setNoteEditingId(step.id); setNoteText(step.improvement_note || ''); }}
                      >
                        {step.improvement_note}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Step */}
      <div className="card mt-4 flex items-center gap-3" style={{ padding: '0.75rem 1rem' }}>
        <span className="flex-shrink-0 text-xs font-mono w-6 text-center" style={{ color: 'var(--text-muted)' }}>
          +
        </span>
        <input
          ref={inputRef}
          type="text"
          value={newStep}
          onChange={(e) => setNewStep(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addStep(); }}
          placeholder="Add a new step..."
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: 'var(--text-primary)' }}
        />
        <button
          onClick={addStep}
          disabled={!newStep.trim()}
          className="btn btn-primary text-sm py-1.5 px-4"
          style={{ opacity: newStep.trim() ? 1 : 0.4 }}
        >
          Add
        </button>
      </div>

      {steps.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-lg font-medium" style={{ color: 'var(--christmas-cream)' }}>
            No workflow steps yet
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Add your payroll process steps above to build a reusable checklist.
          </p>
        </div>
      )}
    </div>
  );
}
