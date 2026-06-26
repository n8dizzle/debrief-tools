import { describe, it, expect } from 'vitest';
import { computeTechPay, TechPayInput } from './techpay';

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
