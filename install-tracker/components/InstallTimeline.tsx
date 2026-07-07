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
          <h2>
            <span className={`pill ${stage.status}`}>{STATUS_LABEL[stage.status]}</span>
            <EditableTitle id={stage.id} text={stage.name} />
          </h2>
          <p className="sub">{stage.summary}</p>
          <ol className="substeps">
            {stage.subSteps.map((step, j) => (
              <li key={step.id ?? `${step.title}-${j}`}>
                <span className="n">{j + 1}</span>
                <span className="st">
                  <EditableTitle id={step.id} text={step.title} />
                  {step.detail && <span className="sd">{step.detail}</span>}
                </span>
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
