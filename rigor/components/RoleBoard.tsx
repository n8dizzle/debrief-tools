'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getProcess, stepsForRole, type Role, type Step } from '@/lib/processes';
import type { WorkItem } from '@/types';

// One board, any role. Which columns appear and which buttons each part offers come
// entirely from the process definition — nothing about "parts" is written here.
//
// DISPLAY groups by job; DATA stays per-part. A job is one card, its parts stacked
// inside, each part moving on its own with its own history. Grouping is a lens, not
// a merge — that distinction is the whole reason this app exists, since pe_orders
// collapses a job's parts into a single row and can only report one status for all
// of them.

// ServiceTitan descriptions arrive as raw HTML ("<ul> <li>Thorough and complete
// cleaning of ductwork...</li>"). Render the text, not the markup — and never with
// dangerouslySetInnerHTML, since this is third-party content.
function plain(s: unknown): string {
  return String(s ?? '')
    .replace(/<li>/gi, ' · ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .replace(/^ *· */, '')
    .trim();
}

interface JobGroup {
  job: string;
  customer: string;
  st_url: string;
  parts: WorkItem[];
  oldestDays: number;
}

export default function RoleBoard({ processKey, role }: { processKey: string; role: Role }) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const proc = getProcess(processKey);
  const columns = useMemo(() => stepsForRole(processKey, role), [processKey, role]);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/items?process=${processKey}&role=${encodeURIComponent(role)}`);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || 'Could not load'); setLoading(false); return; }
    setItems((await res.json()).items || []);
    setLoading(false);
  }, [processKey, role]);

  useEffect(() => { load(); }, [load]);

  async function move(ids: number[], to: string) {
    setBusy(ids[0]);
    for (const id of ids) {
      const res = await fetch('/api/items', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, to }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error || 'Move failed');
        setBusy(null); return;
      }
    }
    setBusy(null);
    load();
  }

  async function undo(ids: number[]) {
    setBusy(ids[0]);
    for (const id of ids) {
      const res = await fetch('/api/items', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, undo: true }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error || 'Undo failed');
        setBusy(null); return;
      }
    }
    setBusy(null);
    load();
  }

  async function saveField(item: WorkItem, key: string, value: string) {
    await fetch('/api/items', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, data: { [key]: value } }),
    });
  }

  if (!proc) return <p style={{ padding: 24 }}>Unknown process “{processKey}”.</p>;

  const jobCount = new Set(items.map(i => i.data?.job || `~${i.id}`)).size;

  return (
    <div className="rb">
      <style>{CSS}</style>

      <header className="rb-head">
        <div>
          <h1>{role}</h1>
          <p className="rb-sub">
            {loading ? 'Loading…' : items.length === 0
              ? 'Nothing waiting on you.'
              : `${jobCount} ${jobCount === 1 ? 'job' : 'jobs'} · ${items.length} parts waiting on you.`}
          </p>
        </div>
        <button className="rb-refresh" onClick={load} disabled={loading}>Refresh</button>
      </header>

      {error && <div className="rb-error">{error}</div>}

      <div className="rb-cols">
        {columns.map(col => {
          const groups = groupByJob(items.filter(i => i.step === col.key));
          const partCount = groups.reduce((n, g) => n + g.parts.length, 0);
          return (
            <section className="rb-col" key={col.key}>
              <div className="rb-col-head">
                <span className="rb-col-name">{col.label}</span>
                <span className="rb-col-count">{groups.length} job{groups.length === 1 ? '' : 's'} · {partCount}</span>
              </div>
              <p className="rb-doing">{col.doing}</p>
              <div className="rb-cards">
                {groups.length === 0 && <p className="rb-empty">Nothing here.</p>}
                {groups.map(g => (
                  <JobCard key={g.job} group={g} col={col} busy={busy}
                           onMove={move} onUndo={undo} onSaveField={saveField} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function groupByJob(list: WorkItem[]): JobGroup[] {
  const map = new Map<string, JobGroup>();
  for (const i of list) {
    // A sold estimate with no job attached still needs a home — key it to itself
    // rather than collapsing every job-less part into one bogus card.
    const key = i.data?.job || `~no-job-${i.id}`;
    let g = map.get(key);
    if (!g) {
      g = { job: key, customer: i.data?.customer || '—', st_url: i.data?.st_url || '', parts: [], oldestDays: 0 };
      map.set(key, g);
    }
    g.parts.push(i);
    const age = Math.max(0, Math.round((Date.now() - Date.parse(i.created_at)) / 86400000));
    if (age > g.oldestDays) g.oldestDays = age;
  }
  return Array.from(map.values()).sort((a, b) => b.oldestDays - a.oldestDays);
}

function JobCard({ group, col, busy, onMove, onUndo, onSaveField }: {
  group: JobGroup; col: Step; busy: number | null;
  onMove: (ids: number[], to: string) => void;
  onUndo: (ids: number[]) => void;
  onSaveField: (i: WorkItem, k: string, v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const anyBusy = group.parts.some(p => p.id === busy);
  const allIds = group.parts.map(p => p.id);
  const multi = group.parts.length > 1;
  const noJob = group.job.startsWith('~no-job-');

  return (
    <article className={`rb-card${anyBusy ? ' busy' : ''}`}>
      <div className="rb-card-top">
        <span className="rb-job">{noJob ? 'no job #' : `#${group.job}`}</span>
        {group.st_url && (
          <a href={group.st_url} target="_blank" rel="noopener noreferrer" title="Open job in ServiceTitan" className="rb-link">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
        <span className={`rb-age${group.oldestDays > 30 ? ' old' : ''}`}>{group.oldestDays}d</span>
      </div>

      <div className="rb-cust">{group.customer}</div>

      <button className="rb-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="rb-count">{group.parts.length}</span>
        {group.parts.length === 1 ? 'part' : 'parts'}
        <span className="rb-chev">{open ? '▴' : '▾'}</span>
      </button>

      {/* Collapsed: names only, so the job reads at a glance. */}
      {!open && (
        <ul className="rb-peek">
          {group.parts.slice(0, 3).map(p => (
            <li key={p.id}>{plain(p.data?.description) || p.data?.sku || '—'}</li>
          ))}
          {group.parts.length > 3 && <li className="rb-more">+{group.parts.length - 3} more</li>}
        </ul>
      )}

      {/* Expanded: every part, individually actionable. */}
      {open && (
        <div className="rb-parts">
          {group.parts.map(p => (
            <div className="rb-part" key={p.id}>
              <div className="rb-part-name">{plain(p.data?.description) || p.data?.sku || '—'}</div>
              <div className="rb-part-meta">
                {p.data?.sku && <span className="rb-sku">{p.data.sku}</span>}
                {p.data?.qty ? <span>qty {p.data.qty}</span> : null}
                {p.data?.unit_cost ? <span>${Number(p.data.unit_cost).toFixed(2)}</span> : null}
              </div>
              <div className="rb-part-moves">
                {col.moves.map(m => (
                  <button key={m.to} disabled={anyBusy} className={`rb-mini ${m.tone || 'go'}`}
                          onClick={() => onMove([p.id], m.to)}>
                    {m.label}
                  </button>
                ))}
                <button disabled={anyBusy} className="rb-undo" title="Send this part back to where it came from"
                        onClick={() => onUndo([p.id])}>↩ Undo</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {col.key === 'needs_order' && (
        <input className="rb-input" placeholder="supplier for this job"
               defaultValue={group.parts[0]?.data?.supplier || ''}
               onBlur={e => group.parts.forEach(p => onSaveField(p, 'supplier', e.target.value))} />
      )}
      {(col.key === 'ordered_ship' || col.key === 'ordered_pickup' || col.key === 'backordered') && (
        <input className="rb-input" placeholder="order #"
               defaultValue={group.parts[0]?.data?.order_num || ''}
               onBlur={e => group.parts.forEach(p => onSaveField(p, 'order_num', e.target.value))} />
      )}

      {/* Collapsed → act on the job. Expanded → act on parts (buttons live on each
          part above). Never both at once: two full sets of overlapping buttons on
          screen reads as duplication, and most orders go out per job anyway, so the
          one-click whole-job path is the default and opening the card is the
          exception for when a single part needs to go its own way. */}
      {!open && col.moves.length > 0 && (
        <div className="rb-moves">
          {col.moves.map(m => (
            <button key={m.to} disabled={anyBusy} className={`rb-btn ${m.tone || 'go'}`}
                    onClick={() => onMove(allIds, m.to)}>
              {m.label}{multi ? ` · all ${group.parts.length}` : ''}
            </button>
          ))}
          <button disabled={anyBusy} className="rb-undo"
                  title={`Send ${multi ? `all ${group.parts.length} parts` : 'this part'} back to the previous step`}
                  onClick={() => onUndo(allIds)}>↩ Undo</button>
        </div>
      )}
      {open && multi && (
        <p className="rb-hint">Acting on parts individually. Close to act on all {group.parts.length} at once.</p>
      )}
    </article>
  );
}

const CSS = `
.rb { --bg:#f5f7f5; --card:#fff; --ink:#15181a; --muted:#5c665f; --faint:#8b958e;
      --line:#dde3dd; --go:#1b6b45; --warn:#9a6410; --quiet:#6b7671; --bad:#a33227;
      color:var(--ink); font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      padding:20px 24px 48px; }
@media (prefers-color-scheme: dark) {
 .rb { --bg:#101312; --card:#181c1a; --ink:#e7ece8; --muted:#9ba79f; --faint:#6e7a73;
       --line:#2a312d; --go:#5fbf8c; --warn:#d9a441; --quiet:#8d9a93; --bad:#e2796a; }
}
.rb-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; }
.rb-head h1 { margin:0; font-size:22px; font-weight:750; letter-spacing:-.02em; }
.rb-sub { margin:2px 0 0; color:var(--muted); font-size:13.5px; }
.rb-refresh { font:inherit; font-size:13px; font-weight:600; padding:6px 12px; border-radius:7px;
  border:1px solid var(--line); background:var(--card); color:var(--muted); cursor:pointer; }
.rb-error { background:rgba(163,50,39,.1); color:var(--bad); border:1px solid var(--bad);
  border-radius:8px; padding:10px 12px; font-size:13.5px; margin-bottom:14px; }
.rb-cols { display:flex; gap:14px; align-items:flex-start; overflow-x:auto; padding-bottom:8px; }
.rb-col { flex:0 0 350px; background:var(--bg); border:1px solid var(--line); border-radius:12px; padding:12px; }
.rb-col-head { display:flex; align-items:baseline; gap:8px; }
.rb-col-name { font-weight:700; font-size:14px; }
.rb-col-count { margin-left:auto; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:11.5px; font-weight:600; color:var(--muted); }
.rb-doing { margin:2px 0 10px; font-size:12.5px; color:var(--faint); }
.rb-cards { display:flex; flex-direction:column; gap:10px; }
.rb-empty { font-size:12.5px; color:var(--faint); margin:2px 0; }
.rb-card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:11px 12px;
  display:flex; flex-direction:column; gap:7px; box-shadow:0 1px 2px rgba(0,0,0,.05); }
.rb-card.busy { opacity:.55; }
.rb-card-top { display:flex; align-items:center; gap:7px; }
.rb-job { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11.5px; font-weight:600; color:var(--muted); }
.rb-link { display:inline-flex; color:var(--muted); }
.rb-age { margin-left:auto; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11.5px; color:var(--faint); }
.rb-age.old { color:var(--warn); font-weight:700; }
.rb-cust { font-weight:700; font-size:14.5px; line-height:1.25; }
.rb-toggle { align-self:flex-start; display:inline-flex; align-items:center; gap:6px;
  font:inherit; font-size:12px; font-weight:650; color:var(--muted); cursor:pointer;
  background:transparent; border:none; padding:0; }
.rb-count { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; background:var(--bg);
  border:1px solid var(--line); border-radius:4px; padding:0 5px; }
.rb-chev { color:var(--faint); }
.rb-peek { margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:2px; }
.rb-peek li { font-size:12.5px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rb-peek .rb-more { color:var(--faint); font-style:italic; }
.rb-parts { display:flex; flex-direction:column; gap:8px; border-top:1px solid var(--line);
  border-bottom:1px solid var(--line); padding:8px 0; }
.rb-part { display:flex; flex-direction:column; gap:4px; }
.rb-part-name { font-size:13px; }
.rb-part-meta { display:flex; flex-wrap:wrap; gap:3px 10px; font-size:11px; color:var(--faint); }
.rb-sku { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
.rb-part-moves { display:flex; flex-wrap:wrap; gap:4px; }
.rb-mini { font:inherit; font-size:11px; font-weight:600; padding:3px 7px; border-radius:5px;
  cursor:pointer; background:transparent; border:1px solid var(--line); color:var(--muted); }
.rb-mini.go:hover { border-color:var(--go); color:var(--go); }
.rb-mini.warn:hover { border-color:var(--warn); color:var(--warn); }
.rb-input { font:inherit; font-size:13px; padding:5px 8px; border-radius:6px;
  border:1px solid var(--line); background:transparent; color:var(--ink); width:100%; }
.rb-moves { display:flex; flex-wrap:wrap; gap:6px; }
.rb-btn { font:inherit; font-size:12.5px; font-weight:650; padding:6px 10px; border-radius:7px;
  cursor:pointer; border:1px solid transparent; color:#fff; }
.rb-btn.go { background:var(--go); border-color:var(--go); }
.rb-btn.warn { background:var(--warn); border-color:var(--warn); }
.rb-btn.quiet { background:transparent; border-color:var(--line); color:var(--muted); }
.rb-btn:disabled, .rb-mini:disabled { opacity:.5; cursor:default; }

/* min-width:0 is the fix for the column running off the right edge: flex items
   default to min-width:auto, so one long unbreakable description pushes the whole
   column past its 350px basis. */
.rb-col, .rb-card, .rb-cards, .rb-parts, .rb-part { min-width: 0; }
.rb-cust, .rb-part-name, .rb-peek li { overflow-wrap: anywhere; }
.rb-part-name { line-height:1.35; }
.rb-peek li { display:block; }
.rb-part { padding:7px 8px; background:var(--bg); border:1px solid var(--line); border-radius:7px; }
.rb-parts { border:none; padding:0; }
.rb-moves { border-top:1px solid var(--line); padding-top:7px; }
/* per-part buttons should read as buttons, not ghosts */
.rb-mini { background:var(--card); color:var(--ink); font-weight:650; }
.rb-mini.go { border-color:var(--go); color:var(--go); }
.rb-mini.warn { border-color:var(--warn); color:var(--warn); }
.rb-mini.quiet { border-color:var(--line); color:var(--faint); }
.rb-mini.go:hover { background:var(--go); color:#fff; }
.rb-mini.warn:hover { background:var(--warn); color:#fff; }
.rb-hint { font-size:11.5px; color:var(--faint); font-style:italic;
  border-top:1px solid var(--line); padding-top:6px; }
.rb-undo { font:inherit; font-size:11.5px; font-weight:600; padding:4px 8px; border-radius:6px;
  cursor:pointer; background:transparent; border:1px dashed var(--line); color:var(--faint); }
.rb-undo:hover { border-style:solid; color:var(--ink); }
`;
