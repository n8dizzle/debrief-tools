/**
 * Technician pay computation for the Install Jobs drawer.
 *
 * Pure, no I/O. The drawer SUGGESTS an amount from the tech's pay type + the job's
 * revenue/hours; the human confirms and can override. On Save the result is FROZEN
 * (pay_amount + pay_basis snapshot) so later rate/% edits never rewrite historical pay.
 *
 * Money in the policy lives in two places by design (see install-jobs memory):
 *   - percent + flat_amount live ON THE PAY TYPE (shared policy)
 *   - hourly_rate lives ON THE TECHNICIAN (per-person)
 */

export type PayMethod = 'percent' | 'hourly' | 'combo' | 'flat';

export interface TechPayInput {
  method: PayMethod;
  percent: number | null;      // pay-type level, e.g. 5 = 5%
  flat_amount: number | null;  // pay-type level
  hourly_rate: number | null;  // technician level
  hours: number | null;        // entered per job (hourly/combo only)
  revenue: number | null;      // job invoice amount (percent/combo only)
}

export interface TechPayResult {
  amount: number | null;       // best-effort suggestion (partial pieces still summed for combo)
  missing: string[];           // inputs needed before the suggestion is complete
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Suggest pay for one technician on one job. Returns a best-effort amount plus a list
 * of missing inputs (e.g. ['revenue'] when ST hasn't posted revenue yet). `amount` is
 * null only when nothing at all can be computed.
 */
export function computeTechPay(input: TechPayInput): TechPayResult {
  const { method, percent, flat_amount, hourly_rate, hours, revenue } = input;
  const missing: string[] = [];

  const pctPart = (): number | null => {
    if (percent == null) { missing.push('percent'); return null; }
    if (revenue == null) { missing.push('revenue'); return null; }
    return revenue * (percent / 100);
  };
  const hourlyPart = (): number | null => {
    if (hourly_rate == null) { missing.push('hourly rate'); return null; }
    if (hours == null) { missing.push('hours'); return null; }
    return hours * hourly_rate;
  };

  switch (method) {
    case 'percent': {
      const p = pctPart();
      return { amount: p == null ? null : round2(p), missing };
    }
    case 'hourly': {
      const h = hourlyPart();
      return { amount: h == null ? null : round2(h), missing };
    }
    case 'combo': {
      const p = pctPart();
      const h = hourlyPart();
      if (p == null && h == null) return { amount: null, missing };
      return { amount: round2((p || 0) + (h || 0)), missing };
    }
    case 'flat': {
      if (flat_amount == null) { missing.push('flat amount'); return { amount: null, missing }; }
      return { amount: round2(flat_amount), missing };
    }
    default:
      return { amount: null, missing: ['method'] };
  }
}

/** Human-readable one-liner for how a suggestion was derived, shown under the input. */
export function payBasisLabel(input: TechPayInput): string {
  const { method, percent, hourly_rate, hours, revenue, flat_amount } = input;
  const money = (n: number | null) =>
    n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  switch (method) {
    case 'percent':
      return `${percent ?? '—'}% of ${money(revenue)} revenue`;
    case 'hourly':
      return `${hours ?? '—'} hrs × ${money(hourly_rate)}/hr`;
    case 'combo':
      return `${percent ?? '—'}% of ${money(revenue)} + ${hours ?? '—'} hrs × ${money(hourly_rate)}/hr`;
    case 'flat':
      return `Flat ${money(flat_amount)}`;
    default:
      return '';
  }
}
