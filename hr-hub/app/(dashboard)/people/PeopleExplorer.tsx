'use client';

import { useEffect, useMemo, useState } from 'react';
import FixList from './FixList';
import SideBySide from './SideBySide';

// Raw people explorer. One tab per system, showing every row that system holds with
// no filtering, matching, or de-duplication. Non-human entities, terminated people, and
// duplicate-looking rows are all left in on purpose — the point is to see the truth.

type Gusto = {
  gusto_uuid: string;
  worker_kind: string;
  first_name: string | null;
  middle_initial: string | null;
  last_name: string | null;
  preferred_first_name: string | null;
  business_name: string | null;
  email: string | null;
  work_email: string | null;
  phone: string | null;
  department: string | null;
  title: string | null;
  employment_status: string | null;
  terminated: boolean;
  termination_date: string | null;
  hire_date: string | null;
  onboarding_status: string | null;
  employee_code: string | null;
};
type StEmployee = {
  st_employee_id: number;
  name: string | null;
  role: string | null;
  trade: string | null;
  business_unit_id: number | null;
  business_unit_name: string | null;
  is_active: boolean | null;
};
type StTech = {
  st_technician_id: number;
  name: string | null;
  trade: string | null;
  business_unit_name: string | null;
  team: string | null;
  is_active: boolean | null;
  show_in_install: boolean | null;
  is_install_lead: boolean | null;
};
type Contractor = {
  id: string;
  name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  trade: string | null;
  is_active: boolean | null;
  has_w9: boolean | null;
  has_coi: boolean | null;
  has_signed_agreement: boolean | null;
};
type Portal = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
  department_id: string | null;
  last_login_at: string | null;
};

type Payload = {
  gusto: Gusto[];
  stEmployees: StEmployee[];
  stTechs: StTech[];
  contractors: Contractor[];
  portal: Portal[];
  pulledAt: string | null;
};

type TabKey = 'fix' | 'compare' | 'gusto' | 'stEmployees' | 'stTechs' | 'contractors' | 'portal';

const TABS: { key: TabKey; label: string; source: string }[] = [
  { key: 'fix', label: 'Fix list', source: 'computed live — what disagrees with Gusto' },
  { key: 'compare', label: 'Side by side', source: 'computed live — Gusto next to ServiceTitan, per person' },
  { key: 'gusto', label: 'Gusto', source: 'hr_gusto_snapshot — HR source of record' },
  { key: 'stEmployees', label: 'ServiceTitan people', source: 'pr_employees — ST employee-id space' },
  { key: 'stTechs', label: 'ServiceTitan techs', source: 'ap_technicians — ST technician-id space' },
  { key: 'contractors', label: 'AP contractors', source: 'ap_contractors — who AP pays' },
  { key: 'portal', label: 'Portal logins', source: 'portal_users — app access' },
];

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
      style={{
        backgroundColor: ok ? 'var(--success-bg, #16653420)' : 'var(--bg-tertiary)',
        color: ok ? 'var(--success-text, #4ade80)' : 'var(--text-muted)',
      }}
    >
      {label}
    </span>
  );
}

export default function PeopleExplorer() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('fix');
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  useEffect(() => {
    fetch('/api/people-explorer')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const counts = useMemo(() => {
    if (!data) return null;
    return {
      fix: 0,
      compare: 0,
      gusto: data.gusto.length,
      stEmployees: data.stEmployees.length,
      stTechs: data.stTechs.length,
      contractors: data.contractors.length,
      portal: data.portal.length,
    } as Record<TabKey, number>;
  }, [data]);

  const needle = q.trim().toLowerCase();
  const match = (...vals: (string | null | undefined)[]) =>
    !needle || vals.some((v) => (v || '').toLowerCase().includes(needle));

  if (error) {
    return (
      <div className="p-6">
        <div
          className="p-4 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        >
          Could not load: {error}
        </div>
      </div>
    );
  }
  if (!data || !counts) {
    return (
      <div className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        Loading every people record from every system...
      </div>
    );
  }

  const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap';
  const td = 'px-3 py-2 text-sm whitespace-nowrap';
  const active = TABS.find((t) => t.key === tab)!;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          People, raw
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Gusto is the source of record for HR data. The fix list shows what disagrees with it; the
          other tabs show each system raw, nothing filtered or merged, non-human entities and
          terminated people included on purpose. No compensation is stored or shown anywhere here.
          {data.pulledAt && (
            <> Gusto snapshot pulled {new Date(data.pulledAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT.</>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === t.key ? 'var(--brand-primary, #166534)' : 'var(--bg-secondary)',
              color: tab === t.key ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {t.label}
            {t.key !== 'fix' && t.key !== 'compare' && <span className="opacity-70"> ({counts[t.key]})</span>}
          </button>
        ))}
      </div>

      {tab !== 'fix' && tab !== 'compare' && (
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by any text on the row..."
          className="px-3 py-1.5 rounded-md text-sm w-72"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
          }}
        />
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Include inactive / terminated
        </label>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          source: <code>{active.source}</code>
        </span>
      </div>
      )}

      {tab === 'fix' && <FixList />}
      {tab === 'compare' && <SideBySide />}

      {tab !== 'fix' && tab !== 'compare' && (
      <div
        className="rounded-lg overflow-x-auto"
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
      >
        {tab === 'gusto' && (
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              <tr>
                {['Legal name', 'Worker Type', 'Department', 'Title', 'Status', 'Hired', 'Ended', 'Email', 'Onboarding'].map((h) => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.gusto
                .filter((r) => (showInactive || !r.terminated))
                .filter((r) => match(r.first_name, r.last_name, r.preferred_first_name, r.business_name, r.department, r.title, r.email, r.work_email, r.employment_status))
                .map((r) => {
                  const legal = r.business_name || [r.first_name, r.middle_initial, r.last_name].filter(Boolean).join(' ');
                  return (
                    <tr key={r.gusto_uuid} style={{ borderTop: '1px solid var(--border-subtle)', opacity: r.terminated ? 0.55 : 1 }}>
                      <td className={td} style={{ color: 'var(--text-primary)' }}>{legal || '—'}</td>
                      <td className={td} style={{ color: 'var(--text-secondary)' }}>
                        {r.worker_kind ? r.worker_kind.charAt(0).toUpperCase() + r.worker_kind.slice(1) : '—'}
                      </td>
                      <td className={td} style={{ color: 'var(--text-secondary)' }}>{r.department || '—'}</td>
                      <td className={td} style={{ color: 'var(--text-secondary)' }}>{r.title || '—'}</td>
                      <td className={td}>{r.terminated ? <Chip ok={false} label="terminated" /> : <Chip ok label={r.employment_status || 'active'} />}</td>
                      <td className={td} style={{ color: 'var(--text-muted)' }}>{r.hire_date || '—'}</td>
                      <td className={td} style={{ color: 'var(--text-muted)' }}>{r.termination_date || '—'}</td>
                      <td className={td} style={{ color: 'var(--text-muted)' }}>{r.work_email || r.email || '—'}</td>
                      <td className={td} style={{ color: 'var(--text-muted)' }}>{r.onboarding_status || '—'}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}

        {tab === 'stEmployees' && (
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              <tr>
                {['Name', 'ST role', 'Business unit', 'Trade', 'st_employee_id', 'Active'].map((h) => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.stEmployees
                .filter((r) => (showInactive || r.is_active))
                .filter((r) => match(r.name, r.role, r.business_unit_name, r.trade, String(r.st_employee_id)))
                .map((r) => (
                  <tr key={`${r.st_employee_id}-${r.role}`} style={{ borderTop: '1px solid var(--border-subtle)', opacity: r.is_active ? 1 : 0.55 }}>
                    <td className={td} style={{ color: 'var(--text-primary)' }}>{r.name || '—'}</td>
                    <td className={td} style={{ color: 'var(--text-secondary)' }}>{r.role || '—'}</td>
                    <td className={td} style={{ color: 'var(--text-secondary)' }}>{r.business_unit_name || '—'}</td>
                    <td className={td} style={{ color: 'var(--text-muted)' }}>{r.trade || '—'}</td>
                    <td className={td} style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.st_employee_id}</td>
                    <td className={td}>{r.is_active ? <Chip ok label="active" /> : <Chip ok={false} label="inactive" />}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {tab === 'stTechs' && (
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              <tr>
                {['Name', 'Business unit', 'Team', 'Trade', 'st_technician_id', 'Flags', 'Active'].map((h) => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.stTechs
                .filter((r) => (showInactive || r.is_active))
                .filter((r) => match(r.name, r.business_unit_name, r.team, r.trade, String(r.st_technician_id)))
                .map((r) => (
                  <tr key={r.st_technician_id} style={{ borderTop: '1px solid var(--border-subtle)', opacity: r.is_active ? 1 : 0.55 }}>
                    <td className={td} style={{ color: 'var(--text-primary)' }}>{r.name || '—'}</td>
                    <td className={td} style={{ color: 'var(--text-secondary)' }}>{r.business_unit_name || '—'}</td>
                    <td className={td} style={{ color: 'var(--text-secondary)' }}>{r.team || '—'}</td>
                    <td className={td} style={{ color: 'var(--text-muted)' }}>{r.trade || '—'}</td>
                    <td className={td} style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.st_technician_id}</td>
                    <td className={td}>
                      <span className="flex gap-1">
                        {r.is_install_lead && <Chip ok label="install lead" />}
                        {r.show_in_install && <Chip ok label="show in install" />}
                      </span>
                    </td>
                    <td className={td}>{r.is_active ? <Chip ok label="active" /> : <Chip ok={false} label="inactive" />}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {tab === 'contractors' && (
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              <tr>
                {['Name in AP', 'Contact', 'Email', 'Phone', 'Trade', 'Compliance', 'Active'].map((h) => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.contractors
                .filter((r) => (showInactive || r.is_active))
                .filter((r) => match(r.name, r.contact_name, r.email, r.trade))
                .map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border-subtle)', opacity: r.is_active ? 1 : 0.55 }}>
                    <td className={td} style={{ color: 'var(--text-primary)' }}>{r.name || '—'}</td>
                    <td className={td} style={{ color: 'var(--text-secondary)' }}>{r.contact_name || '—'}</td>
                    <td className={td} style={{ color: 'var(--text-muted)' }}>{r.email || '—'}</td>
                    <td className={td} style={{ color: 'var(--text-muted)' }}>{r.phone || '—'}</td>
                    <td className={td} style={{ color: 'var(--text-secondary)' }}>{r.trade || '—'}</td>
                    <td className={td}>
                      <span className="flex gap-1">
                        <Chip ok={!!r.has_w9} label="W9" />
                        <Chip ok={!!r.has_coi} label="COI" />
                        <Chip ok={!!r.has_signed_agreement} label="agreement" />
                      </span>
                    </td>
                    <td className={td}>{r.is_active ? <Chip ok label="active" /> : <Chip ok={false} label="inactive" />}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {tab === 'portal' && (
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              <tr>
                {['Name', 'Email', 'Portal role', 'Last login', 'Active'].map((h) => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.portal
                .filter((r) => (showInactive || r.is_active))
                .filter((r) => match(r.name, r.email, r.role))
                .map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border-subtle)', opacity: r.is_active ? 1 : 0.55 }}>
                    <td className={td} style={{ color: 'var(--text-primary)' }}>{r.name || '—'}</td>
                    <td className={td} style={{ color: 'var(--text-muted)' }}>{r.email || '—'}</td>
                    <td className={td} style={{ color: 'var(--text-secondary)' }}>{r.role || '—'}</td>
                    <td className={td} style={{ color: 'var(--text-muted)' }}>
                      {r.last_login_at ? new Date(r.last_login_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago' }) : 'never'}
                    </td>
                    <td className={td}>{r.is_active ? <Chip ok label="active" /> : <Chip ok={false} label="inactive" />}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
      )}
    </div>
  );
}
