import { describe, it, expect } from 'vitest';
import { computeTechPay, TechPayInput, findSubRate, subRateToInput, sameCI, moneySame, toDecimalHours, fromDecimalHours, SubRateInput } from './techpay';

function input(overrides: Partial<TechPayInput> = {}): TechPayInput {
  return {
    method: 'percent',
    percent: null,
    flat_amount: null,
    hourly_rate: null,
    hours: null,
    revenue: null,
    ...overrides,
  };
}

describe('computeTechPay', () => {
  it('percent of revenue', () => {
    const r = computeTechPay(input({ method: 'percent', percent: 5, revenue: 10000 }));
    expect(r.amount).toBe(500);
    expect(r.missing).toEqual([]);
  });

  it('percent with no revenue yet flags missing', () => {
    const r = computeTechPay(input({ method: 'percent', percent: 5, revenue: null }));
    expect(r.amount).toBeNull();
    expect(r.missing).toContain('revenue');
  });

  it('hourly', () => {
    const r = computeTechPay(input({ method: 'hourly', hourly_rate: 35, hours: 8 }));
    expect(r.amount).toBe(280);
    expect(r.missing).toEqual([]);
  });

  it('hourly needs hours', () => {
    const r = computeTechPay(input({ method: 'hourly', hourly_rate: 35, hours: null }));
    expect(r.amount).toBeNull();
    expect(r.missing).toContain('hours');
  });

  it('combo sums both parts', () => {
    const r = computeTechPay(input({ method: 'combo', percent: 3, revenue: 10000, hourly_rate: 25, hours: 4 }));
    expect(r.amount).toBe(400); // 300 + 100
    expect(r.missing).toEqual([]);
  });

  it('combo returns the available part when one side is missing', () => {
    const r = computeTechPay(input({ method: 'combo', percent: 3, revenue: 10000, hourly_rate: 25, hours: null }));
    expect(r.amount).toBe(300); // percent part only
    expect(r.missing).toContain('hours');
  });

  it('flat', () => {
    const r = computeTechPay(input({ method: 'flat', flat_amount: 250 }));
    expect(r.amount).toBe(250);
    expect(r.missing).toEqual([]);
  });

  it('rounds to cents', () => {
    const r = computeTechPay(input({ method: 'percent', percent: 3.33, revenue: 9999 }));
    expect(r.amount).toBe(332.97); // 9999 * 0.0333 = 332.9667 -> 332.97
  });
});

// A sub's rate-card rows. job_type_name '*' is the trade-wide default.
function rate(overrides: Partial<SubRateInput> = {}): SubRateInput {
  return { trade: 'hvac', job_type_name: '*', rate_amount: 12, rate_type: 'percent', ...overrides };
}

describe('findSubRate', () => {
  it('falls back to the trade-wide default when no exact job type', () => {
    const rates = [rate({ job_type_name: '*', rate_amount: 12 })];
    const m = findSubRate(rates, 'hvac', 'Full System Replacement');
    expect(m?.job_type_name).toBe('*');
    expect(m?.rate_amount).toBe(12);
  });

  it('prefers an exact job-type rate over the default', () => {
    const rates = [
      rate({ job_type_name: '*', rate_amount: 12 }),
      rate({ job_type_name: 'Full System Replacement', rate_amount: 18 }),
    ];
    const m = findSubRate(rates, 'hvac', 'Full System Replacement');
    expect(m?.job_type_name).toBe('Full System Replacement');
    expect(m?.rate_amount).toBe(18);
  });

  it('matches trade case-insensitively (ST sends "HVAC")', () => {
    const rates = [rate({ trade: 'hvac', job_type_name: '*' })];
    expect(findSubRate(rates, 'HVAC', 'anything')?.job_type_name).toBe('*');
  });

  it('matches job type case-insensitively', () => {
    const rates = [rate({ job_type_name: 'Heat Pump', rate_amount: 20 })];
    expect(findSubRate(rates, 'hvac', 'heat pump')?.rate_amount).toBe(20);
  });

  it('does not match a different trade', () => {
    const rates = [rate({ trade: 'plumbing', job_type_name: '*' })];
    expect(findSubRate(rates, 'hvac', 'anything')).toBeUndefined();
  });

  it('returns undefined when the sub has no rates', () => {
    expect(findSubRate([], 'hvac', 'anything')).toBeUndefined();
  });

  it('falls back to default when job type is null', () => {
    const rates = [rate({ job_type_name: '*', rate_amount: 12 })];
    expect(findSubRate(rates, 'hvac', null)?.job_type_name).toBe('*');
  });

  it('an exact rate does NOT leak across trades', () => {
    const rates = [
      rate({ trade: 'plumbing', job_type_name: 'Water Heater', rate_amount: 30 }),
      rate({ trade: 'hvac', job_type_name: '*', rate_amount: 10 }),
    ];
    // HVAC job should get the hvac default, not the plumbing exact match.
    const m = findSubRate(rates, 'hvac', 'Water Heater');
    expect(m?.trade).toBe('hvac');
    expect(m?.rate_amount).toBe(10);
  });
});

describe('subRateToInput → computeTechPay (sub money math)', () => {
  it('percent rate = % of invoice revenue', () => {
    const r = computeTechPay(subRateToInput(rate({ rate_type: 'percent', rate_amount: 12 }), 10000));
    expect(r.amount).toBe(1200);
  });

  it('flat rate ignores revenue', () => {
    const r = computeTechPay(subRateToInput(rate({ rate_type: 'flat', rate_amount: 500 }), 10000));
    expect(r.amount).toBe(500);
  });

  it('percent rate with no revenue yet is unresolved', () => {
    const r = computeTechPay(subRateToInput(rate({ rate_type: 'percent', rate_amount: 12 }), null));
    expect(r.amount).toBeNull();
    expect(r.missing).toContain('revenue');
  });
});

describe('moneySame (dirty / stale comparison)', () => {
  it('treats number 500 and string "500" as equal', () => {
    expect(moneySame('500', 500)).toBe(true);
  });
  it('treats "500.00" serialization as equal to 500 (the foot-gun this guards)', () => {
    expect(moneySame('500', 500.00)).toBe(true);
    expect(moneySame('500.00', 500)).toBe(true);
  });
  it('detects a real change to the cent', () => {
    expect(moneySame('500', 550)).toBe(false);
    expect(moneySame('500.01', 500)).toBe(false);
  });
  it('empty input vs null saved = equal (both unset)', () => {
    expect(moneySame('', null)).toBe(true);
    expect(moneySame('', undefined)).toBe(true);
  });
  it('empty vs a saved value = changed (cleared)', () => {
    expect(moneySame('', 500)).toBe(false);
  });
  it('a value vs null saved = changed (newly set)', () => {
    expect(moneySame('500', null)).toBe(false);
  });
});

describe('toDecimalHours / fromDecimalHours', () => {
  it('combines hours and minutes', () => {
    expect(toDecimalHours('7', '30')).toBe(7.5);
    expect(toDecimalHours('8', '0')).toBe(8);
    expect(toDecimalHours('0', '15')).toBe(0.25);
  });
  it('handles one side blank', () => {
    expect(toDecimalHours('7', '')).toBe(7);
    expect(toDecimalHours('', '30')).toBe(0.5);
  });
  it('both blank = null (unresolved, not 0)', () => {
    expect(toDecimalHours('', '')).toBeNull();
    expect(toDecimalHours(null, undefined)).toBeNull();
  });
  it('round-trips through fromDecimalHours', () => {
    expect(fromDecimalHours(7.5)).toEqual({ hours: '7', mins: '30' });
    expect(fromDecimalHours(8)).toEqual({ hours: '8', mins: '' });
    expect(fromDecimalHours(0.5)).toEqual({ hours: '0', mins: '30' });
    expect(fromDecimalHours(null)).toEqual({ hours: '', mins: '' });
  });
  it('hourly pay from h:m matches the decimal', () => {
    // 7h30m × $20/hr = $150
    const dec = toDecimalHours('7', '30');
    const r = computeTechPay({ method: 'hourly', percent: null, flat_amount: null, hourly_rate: 20, hours: dec, revenue: null });
    expect(r.amount).toBe(150);
  });
});

describe('sameCI', () => {
  it('handles null/undefined and trims', () => {
    expect(sameCI('HVAC', 'hvac')).toBe(true);
    expect(sameCI(' Heat Pump ', 'heat pump')).toBe(true);
    expect(sameCI(null, '')).toBe(true);
    expect(sameCI('hvac', 'plumbing')).toBe(false);
  });
});
