// Cross-system people matching. Pure functions, no I/O, so they can be unit tested.
//
// Gusto is the golden source for HR data. ServiceTitan holds only four things per
// person (id, name, businessUnitId, active) — see payroll-tracker's ST sync — so name
// is the only join key available on the ST side. Emails only exist on the Gusto and
// AP-contractor sides, which is why contractors match far more reliably than employees.
//
//   Gusto name forms                 ST name as stored
//   ────────────────────             ─────────────────
//   "Christopher Heil"  (legal)  ──┐
//   "Chris Heil"        (preferred)├─▶ normalize ─▶ (first, last) ─▶ exact hit
//   "R.V. & Sons"       (business) ─┘                    │
//                                                        └─▶ miss ─▶ nickname rule
//                                                                    (same last name +
//                                                                     3-char first prefix)

export type GustoPerson = {
  gusto_uuid: string;
  worker_kind: string;
  first_name: string | null;
  last_name: string | null;
  preferred_first_name: string | null;
  business_name: string | null;
  email: string | null;
  department: string | null;
  title: string | null;
  terminated: boolean;
  termination_date: string | null;
  hire_date: string | null;
};

export type MatchHow = 'exact' | 'nickname';

/**
 * Strip everything that varies between systems but does not change who the person is:
 * parentheticals ("Matt Mims (Office)"), punctuation ("Christina Lewis."), digits, and
 * repeated whitespace. Leaves lowercase letters and single spaces.
 */
export function normalizeName(raw: string | null | undefined): string {
  return (raw || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First and last token of a normalized name. Single-token names get an empty last. */
export function nameKey(raw: string | null | undefined): string {
  const parts = normalizeName(raw).split(' ').filter(Boolean);
  if (parts.length === 0) return '|';
  if (parts.length === 1) return `${parts[0]}|`;
  return `${parts[0]}|${parts[parts.length - 1]}`;
}

/** Every name a Gusto person could plausibly be stored under in another system. */
export function gustoNameForms(g: GustoPerson): string[] {
  const forms = new Set<string>();
  if (g.first_name && g.last_name) forms.add(`${g.first_name} ${g.last_name}`);
  if (g.preferred_first_name && g.last_name) forms.add(`${g.preferred_first_name} ${g.last_name}`);
  if (g.business_name) forms.add(g.business_name);
  return [...forms];
}

/** Display name for a Gusto person: business name for entities, legal name for humans. */
export function gustoDisplayName(g: GustoPerson): string {
  return g.business_name || [g.first_name, g.last_name].filter(Boolean).join(' ') || '(unnamed)';
}

export type GustoIndex = {
  byKey: Map<string, GustoPerson>;
  all: GustoPerson[];
};

export function buildGustoIndex(people: GustoPerson[]): GustoIndex {
  const byKey = new Map<string, GustoPerson>();
  for (const g of people) {
    for (const form of gustoNameForms(g)) {
      const k = nameKey(form);
      // First writer wins so an active record is not shadowed by a terminated namesake.
      if (!byKey.has(k)) byKey.set(k, g);
    }
  }
  return { byKey, all: people };
}

/**
 * Resolve an arbitrary system's name to a Gusto person.
 *
 * Exact key match first. Failing that, the nickname rule: same last name AND the first
 * names share a 3-character prefix in either direction, which catches Chris/Christopher
 * and Ben/Benjamin without matching unrelated people who happen to share a surname.
 * Nickname hits are reported separately so callers can require confirmation.
 */
export function matchToGusto(
  name: string | null | undefined,
  index: GustoIndex
): { person: GustoPerson; how: MatchHow } | null {
  const k = nameKey(name);
  const exact = index.byKey.get(k);
  if (exact) return { person: exact, how: 'exact' };

  const [first, last] = k.split('|');
  if (!last || first.length < 3) return null;

  for (const [gk, person] of index.byKey) {
    const [gFirst, gLast] = gk.split('|');
    if (gLast !== last || !gFirst) continue;
    if (gFirst.startsWith(first.slice(0, 3)) || first.startsWith(gFirst.slice(0, 3))) {
      return { person, how: 'nickname' };
    }
  }
  return null;
}

/** True when this system's stored name matches none of the Gusto spellings. */
export function nameDiffersFromGusto(storedName: string | null | undefined, g: GustoPerson): boolean {
  const stored = normalizeName(storedName);
  return !gustoNameForms(g).some((f) => normalizeName(f) === stored);
}

/**
 * ServiceTitan business unit → the Gusto department it corresponds to. ST uses spaced
 * hyphens and coarser buckets; Gusto splits apprentices and admin into their own
 * departments. Only unambiguous pairs are listed — anything absent is not compared.
 */
export const ST_BU_TO_GUSTO_DEPT: Record<string, string> = {
  'HVAC - Install': 'HVAC-Install',
  'HVAC - Service': 'HVAC-Service',
  'HVAC - Sales': 'HVAC-Sales',
  'Plumbing - Service': 'Plumbing',
};

