'use client';

import { useEffect, useMemo, useState } from 'react';
import { useHRPermissions } from '@/hooks/useHRPermissions';
import type { InstallTech, SkillStatus } from '@/lib/supabase';
import {
  LADDER,
  FLAT_RUNGS,
  getRung,
  rungFromHourlyRate,
  rungItems,
  type LadderRung,
  type LadderSkill,
} from '@/lib/ladder';

type StatusMap = Record<string, SkillStatus>; // key: `${techId}:${skillId}`

const CATEGORY_LABEL: Record<string, string> = {
  skill: 'Skills & Knowledge',
  responsibility: 'Core Responsibilities',
  equipment: 'Equipment Cleared to Install',
};

const NEXT_STATUS: Record<SkillStatus, SkillStatus> = {
  not_started: 'in_progress',
  in_progress: 'verified',
  verified: 'not_started',
};

// ── colors (theme-agnostic tints) ────────────────────────────────────────────
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
  const [techs, setTechs] = useState<InstallTech[]>([]);
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState<'team' | 'tech'>('team');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [tRes, sRes] = await Promise.all([fetch('/api/techs'), fetch('/api/tech-skills')]);
        const tJson = await tRes.json();
        const sJson = await sRes.json();
        if (!alive) return;
        if (!tRes.ok) throw new Error(tJson.error || 'Failed to load roster');
        if (!sRes.ok) throw new Error(sJson.error || 'Failed to load skill statuses');
        const roster: InstallTech[] = tJson.techs || [];
        setTechs(roster);
        const map: StatusMap = {};
        for (const row of sJson.statuses || []) {
          map[`${row.st_technician_id}:${row.skill_id}`] = row.status;
        }
        setStatuses(map);
      } catch (e: any) {
        if (alive) setError(e.message || 'Failed to load');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const statusOf = (techId: number, skillId: string): SkillStatus =>
    statuses[`${techId}:${skillId}`] ?? 'not_started';

  const selected = techs.find((t) => t.st_technician_id === selectedId) || null;

  // The rung a tech currently sits at (explicit placement, else inferred from pay rate).
  const currentRungId = (t: InstallTech): string | null =>
    t.current_rung_id ?? rungFromHourlyRate(t.hourly_rate);

  // ── mutations ──────────────────────────────────────────────────────────────
  async function cycleSkill(techId: number, skillId: string) {
    if (!canEditLadder) return;
    const cur = statusOf(techId, skillId);
    const next = NEXT_STATUS[cur];
    const key = `${techId}:${skillId}`;
    setStatuses((prev) => ({ ...prev, [key]: next })); // optimistic
    try {
      const res = await fetch('/api/tech-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ st_technician_id: techId, skill_id: skillId, status: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setStatuses((prev) => ({ ...prev, [key]: cur })); // revert
    }
  }

  async function setCurrentRung(techId: number, rungId: string) {
    const prior = techs.find((t) => t.st_technician_id === techId)?.current_rung_id ?? null;
    setTechs((prev) => prev.map((t) => (t.st_technician_id === techId ? { ...t, current_rung_id: rungId } : t))); // optimistic
    try {
      const res = await fetch('/api/tech-ladder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ st_technician_id: techId, current_rung_id: rungId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // revert so the UI never lies about a pay-level change that didn't save
      setTechs((prev) => prev.map((t) => (t.st_technician_id === techId ? { ...t, current_rung_id: prior } : t)));
    }
  }

  function selectTech(id: number) {
    setSelectedId(id);
    setView('tech');
  }

  const filteredTechs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? techs.filter((t) => t.name.toLowerCase().includes(q)) : techs;
  }, [techs, search]);

  return (
    <div>
      <Header
        view={view}
        setView={setView}
        canEdit={canEditLadder}
        hasSelection={!!selected}
      />

      {loading ? (
        <div className="mt-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading install roster…
        </div>
      ) : error ? (
        <ErrorPanel message={error} />
      ) : view === 'team' ? (
        <TeamHeatmap
          techs={filteredTechs}
          search={search}
          setSearch={setSearch}
          statusOf={statusOf}
          currentRungId={currentRungId}
          onSelect={selectTech}
        />
      ) : (
        <TechDetail
          tech={selected}
          techs={techs}
          onPick={setSelectedId}
          statusOf={statusOf}
          currentRungId={currentRungId}
          cycleSkill={cycleSkill}
          setCurrentRung={setCurrentRung}
          canEdit={canEditLadder}
        />
      )}
    </div>
  );
}

// ── header ──────────────────────────────────────────────────────────────────
function Header({
  view,
  setView,
  canEdit,
  hasSelection,
}: {
  view: 'team' | 'tech';
  setView: (v: 'team' | 'tech') => void;
  canEdit: boolean;
  hasSelection: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Install Ladder
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          HVAC install progression &amp; skill map — where each tech is on the ladder and what&apos;s
          still missing for the next rung.
          {!canEdit && ' (read-only — ask an admin for edit access)'}
        </p>
      </div>
      <div
        className="inline-flex rounded-lg p-1"
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
      >
        <Toggle active={view === 'team'} onClick={() => setView('team')} label="Team overview" />
        <Toggle active={view === 'tech'} onClick={() => setView('tech')} label="Technician" disabled={!hasSelection && view !== 'tech'} />
      </div>
    </div>
  );
}

function Toggle({ active, onClick, label, disabled }: { active: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40"
      style={{
        backgroundColor: active ? 'var(--christmas-green)' : 'transparent',
        color: active ? 'var(--on-accent)' : 'var(--text-secondary)',
      }}
    >
      {label}
    </button>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-xl p-5" style={{ backgroundColor: C.gapBg, border: `1px solid ${C.gapBd}` }}>
      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
        Couldn&apos;t load the install roster
      </div>
      <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
        {message}. The roster reads from the shared <code>ap_technicians</code> table — if the database
        migration hasn&apos;t been applied yet, checkoffs won&apos;t persist.
      </div>
    </div>
  );
}

// ── team heatmap ──────────────────────────────────────────────────────────────
function TeamHeatmap({
  techs,
  search,
  setSearch,
  statusOf,
  currentRungId,
  onSelect,
}: {
  techs: InstallTech[];
  search: string;
  setSearch: (s: string) => void;
  statusOf: (techId: number, skillId: string) => SkillStatus;
  currentRungId: (t: InstallTech) => string | null;
  onSelect: (id: number) => void;
}) {
  function rungMastery(techId: number, rung: LadderRung) {
    const items = rungItems(rung);
    let verified = 0;
    let progress = 0;
    for (const it of items) {
      const s = statusOf(techId, it.id);
      if (s === 'verified') verified++;
      else if (s === 'in_progress') progress++;
    }
    return { verified, progress, total: items.length };
  }

  function cellStyle(m: { verified: number; progress: number; total: number }) {
    if (m.total === 0) return { backgroundColor: 'var(--bg-card)' };
    if (m.verified === m.total) return { backgroundColor: C.green };
    if (m.verified > 0 || m.progress > 0) {
      const frac = (m.verified + m.progress * 0.5) / m.total;
      return { backgroundColor: `rgba(217,147,10,${0.25 + frac * 0.5})` };
    }
    return { backgroundColor: 'var(--bg-card)', opacity: 0.5 };
  }

  if (techs.length === 0) {
    return (
      <div className="mt-6 rounded-xl p-6 text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
        No install technicians found in the roster.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search technician…"
          className="px-3 py-2 rounded-lg text-sm w-64"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />
        <Legend />
      </div>

      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border-subtle)' }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th
                className="sticky left-0 z-10 text-left px-3 py-2 font-semibold"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', minWidth: 200 }}
              >
                Technician
              </th>
              {LADDER.map((step) => (
                <th
                  key={step.id}
                  colSpan={step.rungs.length}
                  className="px-2 py-2 text-center font-semibold whitespace-nowrap"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderLeft: '1px solid var(--border-subtle)' }}
                >
                  {step.name.replace('Install ', '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {techs.map((t) => {
              const cur = currentRungId(t);
              const curRung = getRung(cur);
              return (
                <tr
                  key={t.st_technician_id}
                  onClick={() => onSelect(t.st_technician_id)}
                  className="cursor-pointer hover:brightness-110 transition"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  <td className="sticky left-0 z-10 px-3 py-2" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <div className="flex items-center gap-2">
                      <Avatar name={t.name} />
                      <div>
                        <div className="font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
                          {t.name}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {curRung ? curRung.payLabel : 'unplaced'}
                          {t.is_install_lead ? ' · lead' : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  {LADDER.flatMap((step) =>
                    step.rungs.map((rung) => {
                      const m = rungMastery(t.st_technician_id, rung);
                      const isCurrent = cur === rung.id;
                      return (
                        <td
                          key={rung.id}
                          title={`${rung.payLabel} — ${m.verified}/${m.total} verified`}
                          className="px-0 py-0 text-center"
                          style={{
                            borderLeft: step.rungs[0].id === rung.id ? '1px solid var(--border-subtle)' : undefined,
                          }}
                        >
                          <div
                            className="mx-auto my-1 rounded flex items-center justify-center"
                            style={{
                              width: 34,
                              height: 26,
                              ...cellStyle(m),
                              outline: isCurrent ? '2px solid var(--text-primary)' : undefined,
                              outlineOffset: -2,
                              fontSize: 10,
                              color: m.verified === m.total && m.total > 0 ? 'var(--on-accent)' : 'var(--text-secondary)',
                            }}
                          >
                            {m.total > 0 ? `${m.verified}/${m.total}` : ''}
                          </div>
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
        Each cell = verified skills on that rung. Outlined cell = the tech&apos;s current pay level. Click a
        row to open the full skill map.
      </p>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
      <span className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: C.green }} /> mastered
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: C.amberBg, border: `1px solid ${C.amberBd}` }} /> in progress
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }} /> not started
      </span>
    </div>
  );
}

// ── tech detail (the skill map) ────────────────────────────────────────────────
function TechDetail({
  tech,
  techs,
  onPick,
  statusOf,
  currentRungId,
  cycleSkill,
  setCurrentRung,
  canEdit,
}: {
  tech: InstallTech | null;
  techs: InstallTech[];
  onPick: (id: number) => void;
  statusOf: (techId: number, skillId: string) => SkillStatus;
  currentRungId: (t: InstallTech) => string | null;
  cycleSkill: (techId: number, skillId: string) => void;
  setCurrentRung: (techId: number, rungId: string) => void;
  canEdit: boolean;
}) {
  if (!tech) {
    return (
      <div className="mt-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Pick a technician from the Team overview to see their skill map.
      </div>
    );
  }

  const curId = currentRungId(tech);
  const curRung = getRung(curId);
  const curOrder = curRung?.order ?? -1;

  // Climb %: verified items across the whole ladder.
  const allItems = FLAT_RUNGS.flatMap((r) => rungItems(r));
  const verifiedCount = allItems.filter((it) => statusOf(tech.st_technician_id, it.id) === 'verified').length;
  const climbPct = Math.round((verifiedCount / allItems.length) * 100);

  // Deficiencies: unverified items at/below the current rung ("should already be able to do").
  const gapsAtLevel = FLAT_RUNGS.filter((r) => r.order <= curOrder).flatMap((r) =>
    rungItems(r)
      .filter((it) => statusOf(tech.st_technician_id, it.id) !== 'verified')
      .map((it) => ({ rung: r, item: it }))
  );
  // Next rung requirements.
  const nextRung = curOrder >= 0 ? FLAT_RUNGS[curOrder + 1] : FLAT_RUNGS[0];
  const nextGaps = nextRung
    ? rungItems(nextRung).filter((it) => statusOf(tech.st_technician_id, it.id) !== 'verified')
    : [];

  return (
    <div>
      {/* Summary header */}
      <div
        className="rounded-xl p-5 mb-5"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={tech.name} size={44} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {tech.name}
                </span>
                {tech.is_install_lead && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(58,143,87,.16)', color: 'var(--christmas-green)' }}>
                    Install Lead
                  </span>
                )}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {curRung ? `${curRung.stepName} · ${curRung.payLabel}` : 'Not yet placed on the ladder'}
              </div>
            </div>
          </div>

          {/* Current rung selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Current level
            </label>
            <select
              value={curId ?? ''}
              disabled={!canEdit}
              onChange={(e) => setCurrentRung(tech.st_technician_id, e.target.value)}
              className="text-sm rounded-lg px-2 py-1.5 disabled:opacity-60"
              style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              <option value="">— unplaced —</option>
              {LADDER.map((step) => (
                <optgroup key={step.id} label={step.name}>
                  {step.rungs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.payLabel}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Climb progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            <span>Ladder mastery</span>
            <span>
              {verifiedCount}/{allItems.length} skills verified · {climbPct}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="h-full rounded-full" style={{ width: `${climbPct}%`, backgroundColor: 'var(--christmas-green)' }} />
          </div>
        </div>

        {/* Deficiency callouts */}
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <GapCard
            title={curOrder >= 0 ? `Gaps at current level (${gapsAtLevel.length})` : 'Gaps at current level'}
            tone="gap"
            empty={
              curOrder >= 0
                ? 'Fully cleared for the current pay level.'
                : 'Not placed on the ladder yet — set a current level to track gaps.'
            }
            items={gapsAtLevel.map((g) => `${g.item.text}  ·  ${g.rung.payLabel}`)}
          />
          <GapCard
            title={nextRung ? `To reach ${nextRung.payLabel} (${nextGaps.length})` : 'Top of the ladder'}
            tone="next"
            empty={nextRung ? 'All requirements met — ready to advance.' : 'This tech is at the top rung.'}
            items={nextGaps.map((it) => it.text)}
          />
        </div>
      </div>

      {/* Quick tech switcher */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {techs.map((t) => (
          <button
            key={t.st_technician_id}
            onClick={() => onPick(t.st_technician_id)}
            className="whitespace-nowrap text-xs px-2.5 py-1 rounded-full transition"
            style={{
              backgroundColor: t.st_technician_id === tech.st_technician_id ? 'var(--christmas-green)' : 'var(--bg-card)',
              color: t.st_technician_id === tech.st_technician_id ? 'var(--on-accent)' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* Ladder */}
      <div className="space-y-6">
        {LADDER.map((step) => (
          <div key={step.id}>
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {step.name}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                {step.payRange}
              </span>
            </div>
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
              {step.subtitle}
            </p>
            <div className="space-y-3">
              {step.rungs.map((rung) => (
                <RungCard
                  key={rung.id}
                  rung={rung}
                  techId={tech.st_technician_id}
                  isCurrent={curId === rung.id}
                  statusOf={statusOf}
                  cycleSkill={cycleSkill}
                  setCurrentRung={setCurrentRung}
                  canEdit={canEdit}
                />
              ))}
            </div>
            <div
              className="mt-3 text-xs rounded-lg px-3 py-2"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-subtle)' }}
            >
              ◆ {step.gate}
            </div>
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
      <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {empty}
        </div>
      ) : (
        <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
          {items.slice(0, 8).map((t, i) => (
            <li key={i} className="flex gap-1.5">
              <span style={{ color: tone === 'gap' ? C.gapTx : C.amberTx }}>•</span>
              <span>{t}</span>
            </li>
          ))}
          {items.length > 8 && <li style={{ color: 'var(--text-muted)' }}>+{items.length - 8} more…</li>}
        </ul>
      )}
    </div>
  );
}

function RungCard({
  rung,
  techId,
  isCurrent,
  statusOf,
  cycleSkill,
  setCurrentRung,
  canEdit,
}: {
  rung: LadderRung;
  techId: number;
  isCurrent: boolean;
  statusOf: (techId: number, skillId: string) => SkillStatus;
  cycleSkill: (techId: number, skillId: string) => void;
  setCurrentRung: (techId: number, rungId: string) => void;
  canEdit: boolean;
}) {
  const items = rungItems(rung);
  const verified = items.filter((it) => statusOf(techId, it.id) === 'verified').length;
  const pct = Math.round((verified / items.length) * 100);

  const grouped: { cat: string; list: LadderSkill[] }[] = [
    { cat: 'skill', list: rung.skills },
    { cat: 'responsibility', list: rung.responsibilities },
    { cat: 'equipment', list: rung.equipment },
  ];

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        border: isCurrent ? '2px solid var(--christmas-green)' : '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-card)',
      }}
    >
      <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
            {rung.payLabel}
          </span>
          {isCurrent && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--on-accent)' }}>
              current
            </span>
          )}
          {pct === 100 && (
            <span title="Rung mastered" style={{ color: 'var(--christmas-green)' }}>
              ✓
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {verified}/{items.length}
          </span>
          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
            <div className="h-full" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? 'var(--christmas-green)' : C.amberTx }} />
          </div>
          {canEdit && !isCurrent && (
            <button
              onClick={() => setCurrentRung(techId, rung.id)}
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
            >
              set current
            </button>
          )}
        </div>
      </div>

      <div className="p-4 grid md:grid-cols-3 gap-4">
        {grouped.map((g) => (
          <div key={g.cat}>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              {CATEGORY_LABEL[g.cat]}
              {g.cat === 'equipment' && <span title="Gate for the raise"> ⛳</span>}
            </div>
            <div className="space-y-1.5">
              {g.list.map((it) => (
                <SkillRow
                  key={it.id}
                  text={it.text}
                  status={statusOf(techId, it.id)}
                  onClick={() => cycleSkill(techId, it.id)}
                  canEdit={canEdit}
                  isGate={g.cat === 'equipment'}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkillRow({
  text,
  status,
  onClick,
  canEdit,
  isGate,
}: {
  text: string;
  status: SkillStatus;
  onClick: () => void;
  canEdit: boolean;
  isGate: boolean;
}) {
  const style =
    status === 'verified'
      ? { bg: 'rgba(58,143,87,0.14)', bd: 'var(--christmas-green)', mark: '✓', markColor: 'var(--christmas-green)' }
      : status === 'in_progress'
      ? { bg: C.amberBg, bd: C.amberBd, mark: '◐', markColor: C.amberTx }
      : { bg: 'transparent', bd: 'var(--border-subtle)', mark: '', markColor: 'var(--text-muted)' };

  return (
    <button
      onClick={onClick}
      disabled={!canEdit}
      className="w-full text-left flex items-start gap-2 rounded-md px-2 py-1.5 transition disabled:cursor-default"
      style={{ backgroundColor: style.bg, border: `1px solid ${style.bd}` }}
      title={canEdit ? 'Click to cycle: not started → in progress → verified' : undefined}
    >
      <span
        className="inline-flex items-center justify-center rounded shrink-0 mt-0.5"
        style={{ width: 16, height: 16, border: `1px solid ${style.markColor}`, color: style.markColor, fontSize: 11 }}
      >
        {style.mark}
      </span>
      <span
        className="text-xs leading-snug"
        style={{
          color: status === 'not_started' ? 'var(--text-secondary)' : 'var(--text-primary)',
          fontWeight: isGate ? 500 : 400,
        }}
      >
        {text}
      </span>
    </button>
  );
}

// ── shared ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-semibold"
      style={{ width: size, height: size, backgroundColor: 'rgba(58,143,87,.18)', color: 'var(--christmas-green)', fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}
