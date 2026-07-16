'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { type Stage } from '@/lib/install-stages';
import { classifyStepSource, SOURCE_META, VALID_SOURCES, defaultSourceSummary } from '@/lib/step-source';
import { can, type AccessUser } from '@/lib/access';

function stepCounts(s: Stage) {
  let auto = 0, manual = 0;
  for (const step of s.subSteps) {
    const src = step.sourceType ?? classifyStepSource(s.name, step.title).source;
    src === 'manual' ? manual++ : auto++;
  }
  return { auto, manual };
}

type EditTarget = { id: string; field: string } | null;

// Inline click-to-edit field. MUST be module-level (stable component identity) — when it
// was defined inside InstallTimeline, every keystroke recreated its type and remounted the
// input, bouncing the caret to the end ("Permit ApprovedA").
function EditField({
  id, field, text, multiline, placeholder, className,
  editable, editing, editValue, busy, setEditValue, setEditing, commitEdit,
}: {
  id?: string; field: string; text: string; multiline?: boolean; placeholder?: string; className?: string;
  editable: boolean; editing: EditTarget; editValue: string; busy: boolean;
  setEditValue: (v: string) => void; setEditing: (e: EditTarget) => void;
  commitEdit: (id: string, field: string, original: string) => void;
}) {
  const active = editable && editing?.id === id && editing?.field === field;
  if (active) {
    const common = {
      autoFocus: true,
      value: editValue,
      disabled: busy,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditValue(e.target.value),
      onBlur: () => commitEdit(id!, field, text),
    };
    return multiline ? (
      <textarea
        className="edit-input edit-area" rows={3} {...common}
        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
      />
    ) : (
      <input
        className="edit-input" {...common}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitEdit(id!, field, text);
          if (e.key === 'Escape') setEditing(null);
        }}
      />
    );
  }
  const canEdit = editable && !!id;
  const empty = !text;
  return (
    <span
      className={`${className ?? ''}${canEdit ? ' editable' : ''}${empty && canEdit ? ' empty' : ''}`}
      onClick={canEdit ? () => { setEditing({ id: id!, field }); setEditValue(text ?? ''); } : undefined}
      title={canEdit ? 'Click to edit' : undefined}
    >
      {text || (canEdit ? (placeholder ?? 'Add…') : '')}
    </span>
  );
}

export default function InstallTimeline({
  stages,
  fromDb,
  workflow = 'full_system',
}: {
  stages: Stage[];
  fromDb: boolean;
  workflow?: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const editable = fromDb && can(session?.user as AccessUser, 'can_edit_workflow');

  const firstActive = stages.findIndex((s) => s.status !== 'done');
  const [selected, setSelected] = useState(firstActive === -1 ? 0 : firstActive);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');
  const [adding, setAdding] = useState<null | { parentId: string | null }>(null);
  const [addValue, setAddValue] = useState('');

  const stage = stages[Math.min(selected, stages.length - 1)];

  async function api(method: 'POST' | 'PATCH', body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch('/api/install-nodes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Request failed' }));
        alert(error || 'Request failed');
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function commitEdit(id: string, field: string, original: string) {
    const raw = editValue;
    setEditing(null);
    if (field === 'title') {
      const t = raw.trim();
      if (!t || t === original) return;
      await api('PATCH', { id, action: 'rename', title: t });
    } else {
      if (raw === (original ?? '')) return;
      await api('PATCH', { id, action: 'edit', fields: { [field]: raw } });
    }
  }

  async function commitAdd(parentId: string | null) {
    const title = addValue.trim();
    if (!title) { setAdding(null); return; }
    const ok = await api('POST', { title, parent_id: parentId, workflow });
    if (ok) { setAdding(null); setAddValue(''); }
  }

  async function moveNode(id: string, direction: 'up' | 'down', isStage: boolean) {
    if (isStage) {
      if (direction === 'up' && selected === 0) return;
      if (direction === 'down' && selected === stages.length - 1) return;
    }
    const ok = await api('PATCH', { id, action: 'move', direction });
    if (ok && isStage) setSelected((s) => (direction === 'up' ? s - 1 : s + 1));
  }

  async function reparentNode(id: string, newParentId: string) {
    await api('PATCH', { id, action: 'reparent', new_parent_id: newParentId });
  }

  // Pin a step's badge type (empty string = revert to auto-inference).
  async function setSourceType(id: string, value: string) {
    await api('PATCH', { id, action: 'edit', fields: { source_type: value } });
  }

  // Stages a sub-step can move to (every stage except the one it's already in).
  const otherStages = stages.filter((s) => s.id && s.id !== stage.id);

  async function archiveNode(id: string, label: string, isStage: boolean) {
    const what = isStage ? 'stage (and its sub-steps)' : 'sub-step';
    if (!confirm(`Archive the ${what} "${label}"? It leaves the board but stays recoverable in the database.`)) return;
    const ok = await api('PATCH', { id, action: 'archive' });
    if (ok && isStage) setSelected((s) => Math.max(0, Math.min(s, stages.length - 2)));
  }

  // Bind the shared edit state to the module-level EditField (called as a function so the
  // input's element type stays EditField — stable, no remount, caret preserved).
  const edit = (p: { id?: string; field: string; text: string; multiline?: boolean; placeholder?: string; className?: string }) => (
    <EditField
      {...p}
      editable={editable} editing={editing} editValue={editValue} busy={busy}
      setEditValue={setEditValue} setEditing={setEditing} commitEdit={commitEdit}
    />
  );

  if (!stage) {
    return (
      <>
        <p className="lede">No stages yet.</p>
        {editable && AddStageInline()}
      </>
    );
  }

  function AddStageInline() {
    if (adding?.parentId === null) {
      return (
        <div className="add-row">
          <input
            className="edit-input" autoFocus placeholder="New stage name…" value={addValue} disabled={busy}
            onChange={(e) => setAddValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAdd(null);
              if (e.key === 'Escape') { setAdding(null); setAddValue(''); }
            }}
          />
          <button className="mini-btn" disabled={busy} onClick={() => commitAdd(null)}>Add</button>
          <button className="mini-btn ghost" disabled={busy} onClick={() => { setAdding(null); setAddValue(''); }}>Cancel</button>
        </div>
      );
    }
    return null;
  }

  return (
    <>
      <div className="rail" role="tablist" aria-label="Install stages">
        {stages.map((s, i) => {
          const c = stepCounts(s);
          return (
            <button
              key={s.id ?? s.name}
              className="node"
              role="tab"
              aria-selected={i === selected}
              onClick={() => setSelected(i)}
            >
              <span className="strip neutral" />
              <span className="body">
                <span className="idx">STAGE {i + 1}</span>
                <div className="nm">{s.name}</div>
                <span className="foot">
                  <span className="src-summary">
                    {c.auto > 0 && <span className="src-auto">{c.auto} auto</span>}
                    {c.auto > 0 && c.manual > 0 && ' · '}
                    {c.manual > 0 && <span className="src-man">{c.manual} manual</span>}
                  </span>
                  <span className="caret">›</span>
                </span>
              </span>
            </button>
          );
        })}
        {editable && adding?.parentId !== null && (
          <button className="node add-node" onClick={() => { setAdding({ parentId: null }); setAddValue(''); }}>
            <span className="body add-body">＋ Add stage</span>
          </button>
        )}
      </div>
      {editable && AddStageInline()}

      <section className="detail">
        <div className="card">
          <div className="cardhead">
            <h2>
              {edit({ id: stage.id, field: 'title', text: stage.name })}
            </h2>
            {editable && stage.id && (
              <div className="tools">
                <button className="icon-btn" title="Move earlier" disabled={busy || selected === 0}
                  onClick={() => moveNode(stage.id!, 'up', true)}>◀</button>
                <button className="icon-btn" title="Move later" disabled={busy || selected === stages.length - 1}
                  onClick={() => moveNode(stage.id!, 'down', true)}>▶</button>
                <button className="icon-btn danger" title="Archive stage" disabled={busy}
                  onClick={() => archiveNode(stage.id!, stage.name, true)}>🗑</button>
              </div>
            )}
          </div>

          <p className="sub">
            {edit({ id: stage.id, field: 'summary', text: stage.summary, multiline: true, placeholder: 'Add a one-line summary…' })}
          </p>

          <ol className="substeps">
            {stage.subSteps.map((step, j) => {
              const src = step.sourceType ?? classifyStepSource(stage.name, step.title).source;
              return (
              <li key={step.id ?? `${step.title}-${j}`}>
                <span className="n">{j + 1}</span>
                <span className="st">
                  {edit({ id: step.id, field: 'title', text: step.title })}
                  <span className={`sd${step.sourceSummary ? '' : ' auto-sum'}`} title={step.sourceSummary ? undefined : 'Auto-generated from the signal — click to word it your way'}>
                    {edit({ id: step.id, field: 'source_summary', text: step.sourceSummary || defaultSourceSummary(stage.name, step.title, src), multiline: true, placeholder: 'Describe where this comes from…' })}
                  </span>
                </span>
                {editable && step.id ? (
                  <select
                    className={`src-badge src-badge-edit ${src}${step.sourceCustom ? '' : ' inferred'}`}
                    value={src}
                    disabled={busy}
                    title={step.sourceCustom ? 'Data source (pinned) — change it, or pick Auto to infer it' : 'Data source (auto-inferred from title + stage) — pick a type to pin it'}
                    onChange={(e) => setSourceType(step.id!, e.target.value)}
                  >
                    {VALID_SOURCES.map((s) => (
                      <option key={s} value={s}>{SOURCE_META[s].label}</option>
                    ))}
                    <option value="">Auto</option>
                  </select>
                ) : (
                  <span className={`src-badge ${src}`} title={SOURCE_META[src].hint}>
                    {SOURCE_META[src].label}
                  </span>
                )}
                {editable && step.id && (
                  <span className="row-tools">
                    <button className="icon-btn sm" title="Move up" disabled={busy || j === 0}
                      onClick={() => moveNode(step.id!, 'up', false)}>↑</button>
                    <button className="icon-btn sm" title="Move down" disabled={busy || j === stage.subSteps.length - 1}
                      onClick={() => moveNode(step.id!, 'down', false)}>↓</button>
                    {otherStages.length > 0 && (
                      <select
                        className="move-select"
                        title="Move to another stage"
                        aria-label="Move to another stage"
                        disabled={busy}
                        value=""
                        onChange={(e) => {
                          const target = e.target.value;
                          e.target.selectedIndex = 0; // reset so it always reads "Move to…"
                          if (target) reparentNode(step.id!, target);
                        }}
                      >
                        <option value="">Move to…</option>
                        {stages.map((s, si) => (
                          s.id && s.id !== stage.id
                            ? <option key={s.id} value={s.id}>{si + 1}. {s.name}</option>
                            : null
                        ))}
                      </select>
                    )}
                    <button className="icon-btn sm danger" title="Archive sub-step" disabled={busy}
                      onClick={() => archiveNode(step.id!, step.title, false)}>🗑</button>
                  </span>
                )}
              </li>
              );
            })}
          </ol>

          {editable && (
            adding?.parentId === stage.id ? (
              <div className="add-row">
                <input
                  className="edit-input" autoFocus placeholder="New sub-step…" value={addValue} disabled={busy}
                  onChange={(e) => setAddValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitAdd(stage.id ?? null);
                    if (e.key === 'Escape') { setAdding(null); setAddValue(''); }
                  }}
                />
                <button className="mini-btn" disabled={busy} onClick={() => commitAdd(stage.id ?? null)}>Add</button>
                <button className="mini-btn ghost" disabled={busy} onClick={() => { setAdding(null); setAddValue(''); }}>Cancel</button>
              </div>
            ) : (
              <button className="add-step" onClick={() => { setAdding({ parentId: stage.id ?? null }); setAddValue(''); }}>
                ＋ Add sub-step
              </button>
            )
          )}
        </div>
      </section>
    </>
  );
}
