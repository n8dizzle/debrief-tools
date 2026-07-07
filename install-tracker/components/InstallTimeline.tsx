'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { STATUS_LABEL, type Stage } from '@/lib/install-stages';

export default function InstallTimeline({
  stages,
  fromDb,
}: {
  stages: Stage[];
  fromDb: boolean;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const editable = fromDb && (role === 'owner' || role === 'manager');

  const firstActive = stages.findIndex((s) => s.status !== 'done');
  const [selected, setSelected] = useState(firstActive === -1 ? 0 : firstActive);
  const [busy, setBusy] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
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

  async function commitRename(id: string, original: string) {
    const title = editValue.trim();
    setEditingId(null);
    if (!title || title === original) return;
    await api('PATCH', { id, action: 'rename', title });
  }

  async function commitAdd(parentId: string | null) {
    const title = addValue.trim();
    if (!title) { setAdding(null); return; }
    const ok = await api('POST', { title, parent_id: parentId });
    if (ok) { setAdding(null); setAddValue(''); }
  }

  async function moveNode(id: string, direction: 'up' | 'down', isStage: boolean) {
    // Guard at the edges so we don't shift selection when the server no-ops.
    if (isStage) {
      if (direction === 'up' && selected === 0) return;
      if (direction === 'down' && selected === stages.length - 1) return;
    }
    const ok = await api('PATCH', { id, action: 'move', direction });
    if (ok && isStage) setSelected((s) => (direction === 'up' ? s - 1 : s + 1));
  }

  async function archiveNode(id: string, label: string, isStage: boolean) {
    const what = isStage ? 'stage (and its sub-steps)' : 'sub-step';
    if (!confirm(`Archive the ${what} "${label}"? It leaves the board but stays recoverable in the database.`)) return;
    const ok = await api('PATCH', { id, action: 'archive' });
    if (ok && isStage) setSelected((s) => Math.max(0, Math.min(s, stages.length - 2)));
  }

  function EditableTitle({ id, text, className }: { id?: string; text: string; className?: string }) {
    if (editable && editingId === id) {
      return (
        <input
          className="edit-input"
          autoFocus
          value={editValue}
          disabled={busy}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => commitRename(id!, text)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename(id!, text);
            if (e.key === 'Escape') setEditingId(null);
          }}
        />
      );
    }
    return (
      <span
        className={`${className ?? ''}${editable && id ? ' editable' : ''}`}
        onClick={editable && id ? () => { setEditingId(id); setEditValue(text); } : undefined}
        title={editable && id ? 'Click to rename' : undefined}
      >
        {text}
      </span>
    );
  }

  if (!stage) {
    return (
      <>
        <p className="lede">No stages yet.</p>
        {editable && <AddStageButton />}
      </>
    );
  }

  function AddStageButton() {
    if (adding?.parentId === null) {
      return (
        <div className="add-row">
          <input
            className="edit-input"
            autoFocus
            placeholder="New stage name…"
            value={addValue}
            disabled={busy}
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
    return (
      <button className="node add-node" onClick={() => { setAdding({ parentId: null }); setAddValue(''); }}>
        <span className="body add-body">＋ Add stage</span>
      </button>
    );
  }

  return (
    <>
      <div className="rail" role="tablist" aria-label="Install stages">
        {stages.map((s, i) => (
          <button
            key={s.id ?? s.name}
            className="node"
            role="tab"
            aria-selected={i === selected}
            onClick={() => setSelected(i)}
          >
            <span className={`strip ${s.status}`} />
            <span className="body">
              <span className="idx">STAGE {i + 1}</span>
              <div className="nm">{s.name}</div>
              <span className="foot">
                <span className={`pill ${s.status}`}>{STATUS_LABEL[s.status]}</span>
                <span className="caret">›</span>
              </span>
            </span>
          </button>
        ))}
        {editable && adding?.parentId !== null && (
          <button className="node add-node" onClick={() => { setAdding({ parentId: null }); setAddValue(''); }}>
            <span className="body add-body">＋ Add stage</span>
          </button>
        )}
      </div>
      {editable && adding?.parentId === null && <AddStageButton />}

      <section className="detail">
        <div className="card">
          <div className="cardhead">
            <h2>
              <span className={`pill ${stage.status}`}>{STATUS_LABEL[stage.status]}</span>
              <EditableTitle id={stage.id} text={stage.name} />
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
          <p className="sub">{stage.summary}</p>
          <ol className="substeps">
            {stage.subSteps.map((step, j) => (
              <li key={step.id ?? `${step.title}-${j}`}>
                <span className="n">{j + 1}</span>
                <span className="st">
                  <EditableTitle id={step.id} text={step.title} />
                  {step.detail && <span className="sd">{step.detail}</span>}
                </span>
                {editable && step.id && (
                  <span className="row-tools">
                    <button className="icon-btn sm" title="Move up" disabled={busy || j === 0}
                      onClick={() => moveNode(step.id!, 'up', false)}>↑</button>
                    <button className="icon-btn sm" title="Move down" disabled={busy || j === stage.subSteps.length - 1}
                      onClick={() => moveNode(step.id!, 'down', false)}>↓</button>
                    <button className="icon-btn sm danger" title="Archive sub-step" disabled={busy}
                      onClick={() => archiveNode(step.id!, step.title, false)}>🗑</button>
                  </span>
                )}
              </li>
            ))}
          </ol>
          {editable && (
            adding?.parentId === stage.id ? (
              <div className="add-row">
                <input
                  className="edit-input"
                  autoFocus
                  placeholder="New sub-step…"
                  value={addValue}
                  disabled={busy}
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

        <div className="card">
          <div className="facts">
            <div className="fact">
              <div className="k">Who owns it</div>
              <div className="v">{stage.who}</div>
            </div>
            <div className="fact">
              <div className="k">Tools used today</div>
              <div className="v">{stage.tools}</div>
            </div>
            <div className="fact">
              <div className="k">Typical duration</div>
              <div className="v dur">{stage.duration}</div>
            </div>
            <div className="fact risk">
              <div className="k">What goes wrong</div>
              <div className="v">{stage.risk}</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
