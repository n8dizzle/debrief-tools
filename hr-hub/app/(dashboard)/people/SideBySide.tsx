'use client';

import { useEffect, useMemo, useState } from 'react';

// Gusto next to ServiceTitan, one row per person, so you can see both at once instead of
// flipping between tabs.
//
// Gusto owns title and department. ServiceTitan has no field for either, so those cells
// read "no field in ST" rather than counting as a mismatch — an empty shelf is not a
// disagreement. Only name, business unit, and active status are genuinely comparable.

type Verdict = 'match' | 'differs' | 'none' | 'unmapped' | 'gusto_only';

type Pair = {
  gustoUuid: string;
  label: string;
  workerKind: string;
  gusto: {
    name: string;
    preferred: string | null;
    department: string | null;
    title: string | null;
    status: string;
    endedOn: string | null;
  };
  st: {
    present: boolean;
    names: string[];
    businessUnits: string[];
    status: string | null;
    employeeIds: number[];
    technicianIds: number[];
  };
  verdict: { name: Verdict; department: Verdict; status: Verdict; title: Verdict };
};

const TONE: Record<Verdict, { fg: string; mark: string; label: string }> = {
  match: { fg: 'var(--success-text, #4ade80)', mark: '=', label: 'agrees' },
  differs: { fg: 'var(--danger-text, #f87171)', mark: '≠', label: 'disagrees' },
  none: { fg: 'var(--text-muted)', mark: '·', label: 'nothing in ST' },
  unmapped: { fg: 'var(--text-muted)', mark: '?', label: 'no mapping' },
  gusto_only: { fg: 'var(--text-muted)', mark: '·', label: 'no field in ST' },
};

function Cell({ verdict, gusto, st }: { verdict: Verdict; gusto: string; st: string }) {
  const t = TONE[verdict];
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }} title={gusto}>
        {gusto || '—'}
      </span>
      <span className="text-xs w-4 text-center shrink-0" style={{ color: t.fg }} title={t.label}>
        {t.mark}
      </span>
      <span
        className="text-sm flex-1 truncate"
        style={{ color: verdict === 'differs' ? t.fg : 'var(--text-secondary)' }}
        title={st}
      >
        {st || <span style={{ color: 'var(--text-muted)' }}>{t.label}</span>}
      </span>
    </div>
  );
}

export default function SideBySide() {
  const [pairs, setPairs] = useState<Pair[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/people-align')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setPairs(d.pairs ?? []))
      .catch((e) => setError(e.message));
  }, []);

  const [onlyProblems, setOnlyProblems] = useState(true);
  const [includeTerminated, setIncludeTerminated] = useState(false);
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    if (!pairs) return [];
    const needle = q.trim().toLowerCase();
    return pairs.filter((p) => {
      if (!includeTerminated && p.gusto.status === 'terminated') return false;
      if (onlyProblems && !Object.values(p.verdict).includes('differs')) return false;
      if (needle && !`${p.label} ${p.gusto.department ?? ''} ${p.gusto.title ?? ''} ${p.st.names.join(' ')}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [pairs, onlyProblems, includeTerminated, q]);

  if (error) return <div className="text-sm" style={{ color: 'var(--text-primary)' }}>Could not load: {error}</div>;
  if (!pairs) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Lining up Gusto against ServiceTitan...</div>;

  const disagreeing = pairs.filter(
    (p) => p.gusto.status !== 'terminated' && Object.values(p.verdict).includes('differs')
  ).length;
  const activeTotal = pairs.filter((p) => p.gusto.status !== 'terminated').length;
  const agreeing = activeTotal - disagreeing;
  const pct = activeTotal === 0 ? 100 : Math.round((agreeing / activeTotal) * 100);

  return (
    <div className="space-y-3">
      {/* Progress reads off live data, not off anything anyone claimed to finish. */}
      <div
        className="rounded-lg p-4"
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {agreeing} of {activeTotal} active people line up with Gusto
          </span>
          <span className="text-2xl font-bold" style={{ color: pct === 100 ? 'var(--success-text, #4ade80)' : 'var(--text-primary)' }}>
            {pct}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              backgroundColor: pct === 100 ? 'var(--success-text, #4ade80)' : 'var(--brand-primary, #166534)',
            }}
          />
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Recomputed from Gusto and ServiceTitan every time this loads. Nothing here is
          self-reported, so the number cannot drift out of date.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a person..."
          className="px-3 py-1.5 rounded-md text-sm w-56"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
        />
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
          Only show disagreements
        </label>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={includeTerminated} onChange={(e) => setIncludeTerminated(e.target.checked)} />
          Include terminated
        </label>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          showing {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <div
          className="rounded-lg p-8 text-center"
          style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="text-lg font-semibold mb-1" style={{ color: 'var(--success-text, #4ade80)' }}>
            Nothing disagrees
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Every active person matches between Gusto and ServiceTitan on name, business unit,
            and status. Untick &ldquo;only show disagreements&rdquo; to see everyone.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <div
              key={p.gustoUuid}
              className="rounded-lg overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                opacity: p.gusto.status === 'terminated' ? 0.6 : 1,
              }}
            >
              <div
                className="px-4 py-2 flex items-center gap-2"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {p.label}
                </span>
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                  {p.workerKind}
                </span>
                {p.gusto.status === 'terminated' && (
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    left {p.gusto.endedOn}
                  </span>
                )}
                {!p.st.present && (
                  <span className="text-[10px] ml-auto" style={{ color: 'var(--warning-text, #fbbf24)' }}>
                    no ServiceTitan record
                  </span>
                )}
              </div>

              <div className="px-4 py-2">
                <div className="flex items-baseline gap-2 pb-1 mb-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <span className="text-[10px] uppercase tracking-wide flex-1" style={{ color: 'var(--text-muted)' }}>Gusto</span>
                  <span className="w-4" />
                  <span className="text-[10px] uppercase tracking-wide flex-1" style={{ color: 'var(--text-muted)' }}>ServiceTitan</span>
                </div>
                <Cell verdict={p.verdict.name} gusto={p.gusto.name} st={p.st.names.join(' / ')} />
                <Cell verdict={p.verdict.department} gusto={p.gusto.department ?? ''} st={p.st.businessUnits.join(' / ')} />
                <Cell verdict={p.verdict.title} gusto={p.gusto.title ?? ''} st="" />
                <Cell verdict={p.verdict.status} gusto={p.gusto.status} st={p.st.status ?? ''} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
