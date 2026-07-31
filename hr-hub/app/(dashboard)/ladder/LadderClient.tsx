'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHRPermissions } from '@/hooks/useHRPermissions';
import type { InstallTech, SkillStatus } from '@/lib/supabase';
import {
  type LadderTree,
  type LadderSummary,
  type LadderTier,
  type LadderBucket,
  flatTiers,
  tierItems,
  itemsForBucket,
  bucketsOnTier,
  getTier,
  tierFromHourlyRate,
} from '@/lib/ladder-types';

type StatusMap = Record<string, SkillStatus>; // key: `${techId}:${itemId}`

const NEXT_STATUS: Record<SkillStatus, SkillStatus> = {
  not_started: 'in_progress',
  in_progress: 'verified',
  verified: 'not_started',
};

const C = {
  green: 'var(--christmas-green)',
  amberBg: 'rgba(217,147,10,0.20)',
  amberBd: 'rgba(217,147,10,0.55)',
  amberTx: '#d9930a',
  gapBg: 'rgba(139,45,50,0.14)',
  gapBd: 'rgba(139,45,50,0.55)',
  gapTx: '#c97878',
};

export default function LadderClient() {
  const { canEditLadder } = useHRPermissions();
  const [ladders, setLadders] = useState<LadderSummary[]>([]);
  const [ladderId, setLadderId] = useState<string | null>(null);
  const [tree, setTree] = useState<LadderTree | null>(null);
  const [techs, setTechs] = useState<InstallTech[]>([]);
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState<'team' | 'tech'>('team');
  const [search, setSearch] = useState('');

  // Load ladder list once.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/ladders');
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(json.error || 'Failed to load ladders');
        const list: LadderSummary[] = json.ladders || [];
        setLadders(list);
        if (list.length) setLadderId(list[0].id);
        else setLoading(false);
      } catch (e: any) {
        if (alive) { setError(e.message || 'Failed to load'); setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, []);

  // Load the selected ladder's tree + roster + checkoffs.
  useEffect(() => {
    if (!ladderId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setSelectedId(null);
    setView('team');
    (async () => {
      try {
        const [lRes, tRes, sRes] = await Promise.all([
          fetch(`/api/ladders/${ladderId}`),
          fetch(`/api/techs?ladder=${ladderId}`),
          fetch(`/api/tech-skills?ladder=${ladderId}`),
        ]);
        const [lJson, tJson, sJson] = await Promise.all([lRes.json(), tRes.json(), sRes.json()]);
        if (!alive) return;
        if (!lRes.ok) throw new Error(lJson.error || 'Failed to load ladder');
        if (!tRes.ok) throw new Error(tJson.error || 'Failed to load roster');
        if (!sRes.ok) throw new Error(sJson.error || 'Failed to load checkoffs');
        setTree(lJson.ladder);
        setTechs(tJson.techs || []);
        const map: StatusMap = {};
        for (const row of sJson.statuses || []) map[`${row.st_technician_id}:${row.item_id}`] = row.status;
        setStatuses(map);
      } catch (e: any) {
        if (alive) setError(e.message || 'Failed to load');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [ladderId]);

  const statusOf = useCallback(
    (techId: number, itemId: string): SkillStatus => statuses[`${techId}:${itemId}`] ?? 'not_started',
    [statuses]
  );

  const selected = techs.find((t) => t.st_technician_id === selectedId) || null;

  const currentTierId = useCallback(
    (t: InstallTech): string | null => t.current_tier_id ?? (tree ? tierFromHourlyRate(tree, t.hourly_rate) : null),
    [tree]
  );

  async function cycleSkill(techId: number, itemId: string) {
    if (!canEditLadder) return;
    const cur = statusOf(techId, itemId);
    const next = NEXT_STATUS[cur];
    const key = `${techId}:${itemId}`;
    setStatuses((prev) => ({ ...prev, [key]: next }));
    try {
      const res = await fetch('/api/tech-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ st_technician_id: techId, item_id: itemId, status: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setStatuses((prev) => ({ ...prev, [key]: cur }));
    }
  }

  async function setCurrentTier(techId: number, tierId: string) {
    if (!ladderId) return;
    const prior = techs.find((t) => t.st_technician_id === techId)?.current_tier_id ?? null;
    setTechs((prev) => prev.map((t) => (t.st_technician_id === techId ? { ...t, current_tier_id: tierId } : t)));
    try {
      const res = await fetch('/api/tech-ladder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ st_technician_id: techId, ladder_id: ladderId, current_tier_id: tierId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTechs((prev) => prev.map((t) => (t.st_technician_id === techId ? { ...t, current_tier_id: prior } : t)));
    }
  }

  const filteredTechs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? techs.filter((t) => t.name.toLowerCase().includes(q)) : techs;
  }, [techs, search]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Career Ladder</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Where each person is on the ladder and what&apos;s still missing for the next rung.
            {!canEditLadder && ' (read-only — ask an admin for edit access)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ladders.length > 0 && (
            <select
              value={ladderId ?? ''}
              onChange={(e) => setLadderId(e.target.value)}
              className="text-sm rounded-lg px-3 py-1.5"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              {ladders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          <div className="inline-flex rounded-lg p-1" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <Toggle active={view === 'team'} onClick={() => setView('team')} label="Team overview" />
            <Toggle active={view === 'tech'} onClick={() => setView('tech')} label="Technician" disabled={!selected && view !== 'tech'} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : error ? (
        <ErrorPanel message={error} />
      ) : !tree ? (
        <div className="mt-6 text-sm" style={{ color: 'var(--text-secondary)' }}>No ladders yet.</div>
      ) : view === 'team' ? (
        <TeamHeatmap tree={tree} techs={filteredTechs} search={search} setSearch={setSearch} statusOf={statusOf} currentTierId={currentTierId} onSelect={(id) => { setSelectedId(id); setView('tech'); }} />
      ) : (
        <TechDetail tree={tree} tech={selected} techs={techs} onPick={setSelectedId} statusOf={statusOf} currentTierId={currentTierId} cycleSkill={cycleSkill} setCurrentTier={setCurrentTier} canEdit={canEditLadder} />
      )}
    </div>
  );
}

function Toggle({ active, onClick, label, disabled }: { active: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40"
      style={{ backgroundColor: active ? 'var(--christmas-green)' : 'transparent', color: active ? 'var(--on-accent)' : 'var(--text-secondary)' }}>
      {label}
    </button>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-xl p-5" style={{ backgroundColor: C.gapBg, border: `1px solid ${C.gapBd}` }}>
      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>Couldn&apos;t load the ladder</div>
      <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{message}.</div>
    </div>
  );
}

// ── team heatmap ──────────────────────────────────────────────────────────────
function TeamHeatmap({ tree, techs, search, setSearch, statusOf, currentTierId, onSelect }: {
  tree: LadderTree; techs: InstallTech[]; search: string; setSearch: (s: string) => void;
  statusOf: (techId: number, itemId: string) => SkillStatus; currentTierId: (t: InstallTech) => string | null; onSelect: (id: number) => void;
}) {
  const levels = [...tree.levels].sort((a, b) => a.sort_order - b.sort_order);

  function tierMastery(techId: number, tier: LadderTier) {
    const items = tierItems(tier);
    let verified = 0, progress = 0;
    for (const it of items) {
      const s = statusOf(techId, it.id);
      if (s === 'verified') verified++; else if (s === 'in_progress') progress++;
    }
    return { verified, progress, total: items.length };
  }
  function cellStyle(m: { verified: number; progress: number; total: number }) {
    if (m.total === 0) return { backgroundColor: 'var(--bg-card)', opacity: 0.4 };
    if (m.verified === m.total) return { backgroundColor: C.green };
    if (m.verified > 0 || m.progress > 0) {
      const frac = (m.verified + m.progress * 0.5) / m.total;
      return { backgroundColor: `rgba(217,147,10,${0.25 + frac * 0.5})` };
    }
    return { backgroundColor: 'var(--bg-card)', opacity: 0.5 };
  }

  if (techs.length === 0) {
    return <div className="mt-6 rounded-xl p-6 text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>No technicians found for this ladder&apos;s roster.</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
          className="px-3 py-2 rounded-lg text-sm w-64" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
        <Legend />
      </div>
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border-subtle)' }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 text-left px-3 py-2 font-semibold" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', minWidth: 200 }}>Technician</th>
              {levels.map((lvl) => (
                <th key={lvl.id} colSpan={Math.max(1, lvl.tiers.length)} className="px-2 py-2 text-center font-semibold whitespace-nowrap"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderLeft: '1px solid var(--border-subtle)' }}>
                  {lvl.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {techs.map((t) => {
              const cur = currentTierId(t);
              const curTier = getTier(tree, cur);
              return (
                <tr key={t.st_technician_id} onClick={() => onSelect(t.st_technician_id)} className="cursor-pointer hover:brightness-110 transition" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td className="sticky left-0 z-10 px-3 py-2" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <div className="flex items-center gap-2">
                      <Avatar name={t.name} />
                      <div>
                        <div className="font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>{t.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{curTier ? (curTier.pay_label || curTier.levelName) : 'unplaced'}{t.is_install_lead ? ' · lead' : ''}</div>
                      </div>
                    </div>
                  </td>
                  {levels.flatMap((lvl) => {
                    const tiers = [...lvl.tiers].sort((a, b) => a.sort_order - b.sort_order);
                    const cells = tiers.length ? tiers : [];
                    return cells.map((tier, i) => {
                      const m = tierMastery(t.st_technician_id, tier);
                      const isCurrent = cur === tier.id;
                      return (
                        <td key={tier.id} title={`${tier.pay_label || lvl.name} — ${m.verified}/${m.total} verified`} className="px-0 py-0 text-center"
                          style={{ borderLeft: i === 0 ? '1px solid var(--border-subtle)' : undefined }}>
                          <div className="mx-auto my-1 rounded flex items-center justify-center"
                            style={{ width: 38, height: 26, ...cellStyle(m), outline: isCurrent ? '2px solid var(--text-primary)' : undefined, outlineOffset: -2, fontSize: 10, color: m.verified === m.total && m.total > 0 ? 'var(--on-accent)' : 'var(--text-secondary)' }}>
                            {m.total > 0 ? `${m.verified}/${m.total}` : ''}
                          </div>
                        </td>
                      );
                    });
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Each cell = verified items on that tier. Outlined = current level. Click a row for the full skill map.</p>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: C.green }} /> mastered</span>
      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: C.amberBg, border: `1px solid ${C.amberBd}` }} /> in progress</span>
      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }} /> not started</span>
    </div>
  );
}

// ── tech detail ────────────────────────────────────────────────────────────────
function TechDetail({ tree, tech, techs, onPick, statusOf, currentTierId, cycleSkill, setCurrentTier, canEdit }: {
  tree: LadderTree; tech: InstallTech | null; techs: InstallTech[]; onPick: (id: number) => void;
  statusOf: (techId: number, itemId: string) => SkillStatus; currentTierId: (t: InstallTech) => string | null;
  cycleSkill: (techId: number, itemId: string) => void; setCurrentTier: (techId: number, tierId: string) => void; canEdit: boolean;
}) {
  if (!tech) return <div className="mt-6 text-sm" style={{ color: 'var(--text-secondary)' }}>Pick someone from the Team overview to see their skill map.</div>;

  const flat = flatTiers(tree);
  const levels = [...tree.levels].sort((a, b) => a.sort_order - b.sort_order);
  const curId = currentTierId(tech);
  const curTier = getTier(tree, curId);
  const curOrder = curTier?.order ?? -1;

  const allItems = flat.flatMap((t) => tierItems(t));
  const verifiedCount = allItems.filter((it) => statusOf(tech.st_technician_id, it.id) === 'verified').length;
  const climbPct = allItems.length ? Math.round((verifiedCount / allItems.length) * 100) : 0;

  const gapsAtLevel = flat.filter((t) => t.order <= curOrder).flatMap((t) =>
    tierItems(t).filter((it) => statusOf(tech.st_technician_id, it.id) !== 'verified').map((it) => ({ tier: t, item: it })));
  const nextTier = curOrder >= 0 ? flat[curOrder + 1] : flat[0];
  const nextGaps = nextTier ? tierItems(nextTier).filter((it) => statusOf(tech.st_technician_id, it.id) !== 'verified') : [];

  return (
    <div>
      <div className="rounded-xl p-5 mb-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={tech.name} size={44} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{tech.name}</span>
                {tech.is_install_lead && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(58,143,87,.16)', color: 'var(--christmas-green)' }}>Lead</span>}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{curTier ? `${curTier.levelName}${curTier.pay_label ? ' · ' + curTier.pay_label : ''}` : 'Not yet placed on the ladder'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Current level</label>
            <select value={curId ?? ''} disabled={!canEdit} onChange={(e) => setCurrentTier(tech.st_technician_id, e.target.value)}
              className="text-sm rounded-lg px-2 py-1.5 disabled:opacity-60" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
              <option value="">— unplaced —</option>
              {levels.map((lvl) => (
                <optgroup key={lvl.id} label={lvl.name}>
                  {[...lvl.tiers].sort((a, b) => a.sort_order - b.sort_order).map((tr) => (
                    <option key={tr.id} value={tr.id}>{tr.pay_label || lvl.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            <span>Ladder mastery</span><span>{verifiedCount}/{allItems.length} verified · {climbPct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="h-full rounded-full" style={{ width: `${climbPct}%`, backgroundColor: 'var(--christmas-green)' }} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <GapCard title={curOrder >= 0 ? `Gaps at current level (${gapsAtLevel.length})` : 'Gaps at current level'} tone="gap"
            empty={curOrder >= 0 ? 'Fully cleared for the current level.' : 'Not placed yet — set a current level to track gaps.'}
            items={gapsAtLevel.map((g) => `${g.item.text}${g.tier.pay_label ? '  ·  ' + g.tier.pay_label : ''}`)} />
          <GapCard title={nextTier ? `To reach ${nextTier.pay_label || nextTier.levelName} (${nextGaps.length})` : 'Top of the ladder'} tone="next"
            empty={nextTier ? 'All requirements met — ready to advance.' : 'At the top tier.'} items={nextGaps.map((it) => it.text)} />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {techs.map((t) => (
          <button key={t.st_technician_id} onClick={() => onPick(t.st_technician_id)} className="whitespace-nowrap text-xs px-2.5 py-1 rounded-full transition"
            style={{ backgroundColor: t.st_technician_id === tech.st_technician_id ? 'var(--christmas-green)' : 'var(--bg-card)', color: t.st_technician_id === tech.st_technician_id ? 'var(--on-accent)' : 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            {t.name}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {levels.map((lvl) => (
          <div key={lvl.id}>
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{lvl.name}</h2>
              {lvl.timeframe && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{lvl.timeframe}</span>}
            </div>
            {lvl.subtitle && <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>{lvl.subtitle}</p>}
            <div className="space-y-3">
              {[...lvl.tiers].sort((a, b) => a.sort_order - b.sort_order).map((tier) => (
                <TierCard key={tier.id} tree={tree} tier={tier} levelName={lvl.name} techId={tech.st_technician_id} isCurrent={curId === tier.id}
                  statusOf={statusOf} cycleSkill={cycleSkill} setCurrentTier={setCurrentTier} canEdit={canEdit} />
              ))}
            </div>
            {lvl.gate_note && <div className="mt-3 text-xs rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-subtle)' }}>◆ {lvl.gate_note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function GapCard({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: 'gap' | 'next' }) {
  const bg = tone === 'gap' ? C.gapBg : 'var(--bg-secondary)';
  const bd = tone === 'gap' ? C.gapBd : 'var(--border-subtle)';
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: bg, border: `1px solid ${bd}` }}>
      <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</div>
      {items.length === 0 ? <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{empty}</div> : (
        <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
          {items.slice(0, 8).map((t, i) => <li key={i} className="flex gap-1.5"><span style={{ color: tone === 'gap' ? C.gapTx : C.amberTx }}>•</span><span>{t}</span></li>)}
          {items.length > 8 && <li style={{ color: 'var(--text-muted)' }}>+{items.length - 8} more…</li>}
        </ul>
      )}
    </div>
  );
}

function TierCard({ tree, tier, levelName, techId, isCurrent, statusOf, cycleSkill, setCurrentTier, canEdit }: {
  tree: LadderTree; tier: LadderTier; levelName: string; techId: number; isCurrent: boolean;
  statusOf: (techId: number, itemId: string) => SkillStatus; cycleSkill: (techId: number, itemId: string) => void; setCurrentTier: (techId: number, tierId: string) => void; canEdit: boolean;
}) {
  const items = tierItems(tier);
  const verified = items.filter((it) => statusOf(techId, it.id) === 'verified').length;
  const pct = items.length ? Math.round((verified / items.length) * 100) : 0;
  const buckets = bucketsOnTier(tree, tier);
  const heading = tier.pay_label || levelName;

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: isCurrent ? '2px solid var(--christmas-green)' : '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)' }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{heading}</span>
          {isCurrent && <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--on-accent)' }}>current</span>}
          {pct === 100 && items.length > 0 && <span title="Mastered" style={{ color: 'var(--christmas-green)' }}>✓</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{verified}/{items.length}</span>
          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
            <div className="h-full" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? 'var(--christmas-green)' : C.amberTx }} />
          </div>
          {canEdit && !isCurrent && <button onClick={() => setCurrentTier(techId, tier.id)} className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>set current</button>}
        </div>
      </div>
      {tier.gate_note && <div className="px-4 py-1.5 text-xs" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)' }}>◆ {tier.gate_note}</div>}
      <div className="p-4 grid md:grid-cols-3 gap-4">
        {buckets.map((b: LadderBucket) => (
          <div key={b.id}>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{b.name}{b.is_gate && <span title="Gate for the raise"> ⛳</span>}</div>
            <div className="space-y-1.5">
              {itemsForBucket(tier, b.id).map((it) => (
                <SkillRow key={it.id} text={it.text} status={statusOf(techId, it.id)} onClick={() => cycleSkill(techId, it.id)} canEdit={canEdit} isGate={it.is_gate} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkillRow({ text, status, onClick, canEdit, isGate }: { text: string; status: SkillStatus; onClick: () => void; canEdit: boolean; isGate: boolean }) {
  const style = status === 'verified'
    ? { bg: 'rgba(58,143,87,0.14)', bd: 'var(--christmas-green)', mark: '✓', markColor: 'var(--christmas-green)' }
    : status === 'in_progress'
    ? { bg: C.amberBg, bd: C.amberBd, mark: '◐', markColor: C.amberTx }
    : { bg: 'transparent', bd: 'var(--border-subtle)', mark: '', markColor: 'var(--text-muted)' };
  return (
    <button onClick={onClick} disabled={!canEdit} className="w-full text-left flex items-start gap-2 rounded-md px-2 py-1.5 transition disabled:cursor-default"
      style={{ backgroundColor: style.bg, border: `1px solid ${style.bd}` }} title={canEdit ? 'Click to cycle: not started → in progress → verified' : undefined}>
      <span className="inline-flex items-center justify-center rounded shrink-0 mt-0.5" style={{ width: 16, height: 16, border: `1px solid ${style.markColor}`, color: style.markColor, fontSize: 11 }}>{style.mark}</span>
      <span className="text-xs leading-snug" style={{ color: status === 'not_started' ? 'var(--text-secondary)' : 'var(--text-primary)', fontWeight: isGate ? 500 : 400 }}>{text}</span>
    </button>
  );
}

function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return <div className="rounded-full flex items-center justify-center shrink-0 font-semibold" style={{ width: size, height: size, backgroundColor: 'rgba(58,143,87,.18)', color: 'var(--christmas-green)', fontSize: size * 0.4 }}>{initials}</div>;
}
