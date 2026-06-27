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

/** A contractor rate-card row, reduced to what pay computation needs. */
export interface SubRateInput {
  trade: string;
  job_type_name: string;
  rate_amount: number;
  rate_type: 'flat' | 'percent';
}

/** Case-insensitive, trim-tolerant string compare (ServiceTitan trade/type casing varies). */
export function sameCI(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

/**
 * Find a sub's rate for a job: prefer an exact job-type match, else fall back to the
 * trade-wide default ('*'). Lets a sub have one "12% on all HVAC jobs" rate plus
 * per-type overrides. Generic so callers can pass their fuller rate shape.
 */
export function findSubRate<T extends { trade: string; job_type_name: string }>(
  rates: T[], trade: string | null, jobType: string | null
): T | undefined {
  const tradeRates = rates.filter(r => sameCI(r.trade, trade));
  return tradeRates.find(r => r.job_type_name !== '*' && sameCI(r.job_type_name, jobType))
      || tradeRates.find(r => r.job_type_name === '*');
}

/**
 * Compare a money input string against a stored number, to the cent. Treats '' and
 * null as "empty" (equal to each other). Avoids string-equality foot-guns when the
 * DB serializes numeric as "500.00" vs the input's "500".
 */
export function moneySame(amountStr: string | null | undefined, saved: number | null | undefined): boolean {
  const aEmpty = amountStr === '' || amountStr == null;
  const bEmpty = saved == null;
  if (aEmpty && bEmpty) return true;
  if (aEmpty !== bEmpty) return false;
  return Math.round(Number(amountStr) * 100) === Math.round(Number(saved) * 100);
}

/** A subcontractor rate maps onto the same compute fn as a percent/flat pay type. */
export function subRateToInput(r: SubRateInput, revenue: number | null): TechPayInput {
  return r.rate_type === 'percent'
    ? { method: 'percent', percent: r.rate_amount, flat_amount: null, hourly_rate: null, hours: null, revenue }
    : { method: 'flat', percent: null, flat_amount: r.rate_amount, hourly_rate: null, hours: null, revenue };
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
