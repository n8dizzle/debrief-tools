'use client';

import { useEffect, useState } from 'react';

// Punch list for aligning other systems to Gusto. Grouped by where the fix lives, since
// that is what decides what you actually do about it. Recomputed on every load, so items
// vanish once the underlying record is genuinely fixed — there is no "mark as done".

type Align = {
  fixInSt: {
    terminatedStillActive: { label: string; stName: string; idSpace: string; stId: number; endedOn: string | null; businessUnit: string | null }[];
    missingInSt: { label: string; workerKind: string; title: string | null; department: string | null; hiredOn: string | null }[];
    nameDrift: { label: string; stName: string; gustoName: string; idSpace: string; how: string }[];
    buDrift: { label: string; businessUnit: string; gustoDepartment: string }[];
    notInGusto: { stName: string; stRole: string | null; businessUnit: string | null; idSpace: string; stId: number }[];
  };
  notAConcern: { stName: string; idSpace: string; stId: string; disposition: string; note: string | null }[];
  unsyncable: string[];
  openCount: number;
};

function Copy({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
      className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        color: done ? 'var(--success-text, #4ade80)' : 'var(--text-muted)',
        border: '1px solid var(--border-subtle)',
      }}
      title={`Copy "${value}"`}
    >
      {done ? 'copied' : 'copy'}
    </button>
  );
}

function Group({
  title,
  count,
  note,
  defaultOpen = false,
  tone = 'normal',
  children,
}: {
  title: string;
  count: number;
  note?: string;
  defaultOpen?: boolean;
  tone?: 'normal' | 'urgent';
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: `1px solid ${tone === 'urgent' ? 'var(--danger-border, #dc262660)' : 'var(--border-subtle)'}`,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
      >
        <span style={{ color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</span>
        <span className="text-sm font-semibold" style={{ color: tone === 'urgent' ? 'var(--danger-text, #f87171)' : 'var(--text-primary)' }}>
          {title}
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-xs font-semibold"
          style={{
            backgroundColor: tone === 'urgent' ? 'var(--danger-bg, #dc262620)' : 'var(--bg-secondary)',
            color: tone === 'urgent' ? 'var(--danger-text, #f87171)' : 'var(--text-secondary)',
          }}
        >
          {count}
        </span>
        {note && (
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            {note}
          </span>
        )}
      </button>
      {open && <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>{children}</div>}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      {children}
    </div>
  );
}

const nameStyle = { color: 'var(--text-primary)', minWidth: '13rem' } as const;
const dimStyle = { color: 'var(--text-muted)' } as const;

const KINDS: { key: string; label: string; hint: string }[] = [
  { key: 'not_a_person', label: 'Not a person', hint: 'scheduling placeholder, team bucket, queue' },
  { key: 'vendor', label: 'Vendor', hint: 'an outside company, not staff' },
  { key: 'system_account', label: 'System account', hint: 'an integration or login, not a human' },
  { key: 'unmanaged', label: 'Not ours to manage', hint: 'a real person we deliberately do not track here' },
];

/**
 * Classify a ServiceTitan record as something we do not manage.
 *
 * This is a statement about what the record IS, which stays true — deliberately not a
 * "done" checkbox, because a completion claim goes stale the moment ServiceTitan changes
 * and then the list lies to you. A classification cannot go stale, so it can be trusted.
 */
function Disposition({
  system, id, name, onDone,
}: { system: string; id: string | number; name: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = async (kind: string) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/people-disposition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system, external_id: String(id), external_name: name, disposition: kind }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      onDone();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false); setOpen(false);
    }
  };

  if (err) return <span className="text-[10px]" style={{ color: 'var(--danger-text, #f87171)' }}>{err}</span>;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={busy}
        className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
        style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
        title="Classify this record as something we do not manage, so it stops appearing here"
      >
        {busy ? '...' : 'not a concern'}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap gap-1">
      {KINDS.map((k) => (
        <button
          key={k.key}
          onClick={() => set(k.key)}
          className="px-1.5 py-0.5 rounded text-[10px]"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
          title={k.hint}
        >
          {k.label}
        </button>
      ))}
      <button onClick={() => setOpen(false)} className="px-1.5 py-0.5 text-[10px]" style={dimStyle}>
        cancel
      </button>
    </span>
  );
}

export default function FixList() {
  const [data, setData] = useState<Align | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    fetch('/api/people-align')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [reloadKey]);

  if (error) return <div className="text-sm" style={{ color: 'var(--text-primary)' }}>Could not load: {error}</div>;
  if (!data) return <div className="text-sm" style={dimStyle}>Comparing every system against Gusto...</div>;

  const st = data.fixInSt;

  return (
    <div className="space-y-5">
      <p className="text-sm" style={dimStyle}>
        {data.openCount} open items. Recomputed live every time you load this — an item disappears
        once the record is actually fixed, so there is nothing to check off.
      </p>

      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          Fix in ServiceTitan
          <span className="ml-2 font-normal normal-case" style={dimStyle}>ServiceTitan has these fields</span>
        </h2>

        <Group
          title="Terminated in Gusto, still active in ServiceTitan"
          count={st.terminatedStillActive.length}
          note="deactivate in ST"
          tone="urgent"
          defaultOpen
        >
          <div className="px-4 py-2.5 text-xs" style={{ ...dimStyle, borderTop: '1px solid var(--border-subtle)' }}>
            Trustworthy as of 2026-08-03. Until then our ST mirror could not detect a
            deactivation at all: the sync omitted the <code>active</code> query parameter, which
            ServiceTitan treats as active-only, so deactivated people dropped out of the response
            and their rows kept whatever state they last had. Every one of the 39 terminated
            people in the table read as active, one of them for 17 months. Fixed in PR #224 —
            these rows now come straight from ServiceTitan, so anything listed here is a real
            offboarding gap worth acting on.
          </div>
          {st.terminatedStillActive.map((r, i) => (
            <Row key={`${r.idSpace}-${r.stId}-${i}`}>
              <span style={nameStyle}>{r.label}</span>
              <span style={dimStyle}>left {r.endedOn}</span>
              <span style={dimStyle}>
                ST record &ldquo;{r.stName}&rdquo; {r.businessUnit ? `· ${r.businessUnit}` : ''}
              </span>
              <span className="ml-auto text-[10px] font-mono" style={dimStyle}>{r.idSpace} {r.stId}</span>
            </Row>
          ))}
        </Group>

        <Group title="In Gusto, no ServiceTitan record" count={st.missingInSt.length} note="create in ST, if they need ST access">
          {st.missingInSt.map((r) => (
            <Row key={r.label}>
              <span style={nameStyle}>{r.label}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{r.title || '—'}</span>
              <span style={dimStyle}>{r.department || '—'}</span>
              <span style={dimStyle}>hired {r.hiredOn}</span>
              <span className="ml-auto text-[10px] uppercase" style={dimStyle}>{r.workerKind}</span>
              <Copy value={r.label} />
            </Row>
          ))}
        </Group>

        <Group title="Name spelling differs from Gusto" count={st.nameDrift.length} note="do these last — some apps match on name">
          {st.nameDrift.map((r, i) => (
            <Row key={`${r.idSpace}-${r.stName}-${i}`}>
              <span style={nameStyle}>{r.label}</span>
              <span style={dimStyle}>ST has &ldquo;{r.stName}&rdquo;</span>
              <span style={{ color: 'var(--text-primary)' }}>→ {r.gustoName}</span>
              {r.how === 'nickname' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                  matched by nickname, confirm it is the same person
                </span>
              )}
              <Copy value={r.gustoName} />
            </Row>
          ))}
        </Group>

        <Group title="Business unit disagrees with Gusto department" count={st.buDrift.length}>
          {st.buDrift.map((r) => (
            <Row key={r.label}>
              <span style={nameStyle}>{r.label}</span>
              <span style={dimStyle}>ST {r.businessUnit}</span>
              <span style={{ color: 'var(--text-primary)' }}>Gusto {r.gustoDepartment}</span>
            </Row>
          ))}
        </Group>

        <Group title="Active in ServiceTitan, nothing in Gusto" count={st.notInGusto.length} note="classify once: person, vendor, or queue">
          {st.notInGusto.map((r) => (
            <Row key={`${r.stId}-${r.stName}`}>
              <span style={nameStyle}>{r.stName}</span>
              <span style={dimStyle}>{r.stRole || '—'}</span>
              <span style={dimStyle}>{r.businessUnit || 'no business unit'}</span>
              <span className="ml-auto flex items-center gap-2">
                <span className="text-[10px] font-mono" style={dimStyle}>{r.stId}</span>
                <Disposition system={r.idSpace} id={r.stId} name={r.stName} onDone={reload} />
              </span>
            </Row>
          ))}
        </Group>

        <Group
          title="Classified as not a concern"
          count={data.notAConcern.length}
          note="kept here so a wrong call can be undone"
        >
          {data.notAConcern.map((r) => (
            <Row key={`${r.idSpace}-${r.stId}`}>
              <span style={nameStyle}>{r.stName}</span>
              <span style={dimStyle}>{KINDS.find((k) => k.key === r.disposition)?.label ?? r.disposition}</span>
              {r.note && <span style={dimStyle}>{r.note}</span>}
              <button
                onClick={async () => {
                  await fetch('/api/people-disposition', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ system: r.idSpace, external_id: r.stId, disposition: null }),
                  });
                  reload();
                }}
                className="ml-auto px-1.5 py-0.5 rounded text-[10px]"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
              >
                put back
              </button>
            </Row>
          ))}
        </Group>
      </div>


      <div
        className="rounded-lg px-4 py-3 text-sm"
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Cannot be aligned to ServiceTitan at all
        </div>
        <p style={dimStyle}>
          ServiceTitan stores only a name, a business unit, and an active flag per person. It has
          nowhere to put {data.unsyncable.join(', ')}. Those live in Gusto and only Gusto, so the fix
          for those is for our own apps to read Gusto rather than asking ServiceTitan. Compensation is
          not compared, stored, or shown anywhere in this app.
        </p>
      </div>
    </div>
  );
}
