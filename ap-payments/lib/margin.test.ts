import { describe, it, expect } from 'vitest';
import { computeAdjustedMargin, MarginJobInput, CostAdjustment } from './margin';

// A synced job baseline (ST cost buckets present). Override per test.
function job(overrides: Partial<MarginJobInput> = {}): MarginJobInput {
  return {
    assignment_type: 'unassigned',
    payment_amount: null,
    st_revenue: 10000,
    st_equipment_cost: 4000,
    st_material_cost: 1000,
    st_labor_cost: 500,
    st_total_cost: 5500, // = equip + material + labor (no PO/return cost in baseline)
    st_gross_margin: 4500,
    st_gross_margin_pct: 0.45,
    costs_synced_at: '2026-06-25T00:00:00Z',
    ...overrides,
  };
}

describe('computeAdjustedMargin', () => {
  it('unassigned: adjusted margin equals ST when there are no adjustments', () => {
    const r = computeAdjustedMargin(job(), []);
    expect(r.hasCostData).toBe(true);
    expect(r.revenue).toBe(10000);
    expect(r.adjustedTotalCost).toBe(5500);
    expect(r.adjustedGrossMargin).toBe(4500);
    expect(r.adjustedGrossMarginPct).toBeCloseTo(0.45, 4);
    expect(r.contractorLabor).toBe(0);
  });

  it('contractor: adds the live payment_amount as labor cost (the headline correction)', () => {
    // Subbed job: ST sees almost no labor ($31), real labor is the $4000 contractor payment.
    const r = computeAdjustedMargin(
      job({
        assignment_type: 'contractor',
        payment_amount: 4000,
        st_labor_cost: 31,
        st_total_cost: 5031, // equip 4000 + material 1000 + labor 31
        st_gross_margin: 4969,
        st_gross_margin_pct: 0.4969,
      }),
      []
    );
    expect(r.contractorLabor).toBe(4000);
    expect(r.laborCost).toBe(4031); // ST labor 31 + contractor 4000
    expect(r.adjustedTotalCost).toBe(9031); // 5031 + 4000
    expect(r.adjustedGrossMargin).toBe(969); // 10000 - 9031
    expect(r.adjustedGrossMarginPct).toBeCloseTo(0.0969, 4);
    // ST overstated it at ~49.7%; true margin is ~9.7%.
    expect(r.stGrossMarginPct).toBeCloseTo(0.4969, 4);
  });

  it('in_house: uses ST labor, never adds contractor payment (no double-count)', () => {
    const r = computeAdjustedMargin(
      job({ assignment_type: 'in_house', payment_amount: 9999 /* should be ignored */ }),
      []
    );
    expect(r.contractorLabor).toBe(0);
    expect(r.laborCost).toBe(500); // ST labor only
    expect(r.adjustedTotalCost).toBe(5500);
    expect(r.adjustedGrossMargin).toBe(4500);
  });

  it('signed adjustments: positive adds cost, negative corrects down', () => {
    const adjustments: CostAdjustment[] = [
      { bucket: 'soft_cost', amount: 250 }, // permit
      { bucket: 'equipment', amount: -400 }, // ST over-counted equipment
      { bucket: 'overhead', amount: 300 },
    ];
    const r = computeAdjustedMargin(job(), adjustments);
    expect(r.manualAdjustmentTotal).toBe(150); // 250 - 400 + 300
    expect(r.equipmentCost).toBe(3600); // 4000 - 400
    expect(r.softCost).toBe(250);
    expect(r.overheadCost).toBe(300);
    expect(r.adjustedTotalCost).toBe(5650); // 5500 + 150
    expect(r.adjustedGrossMargin).toBe(4350); // 10000 - 5650
  });

  it('soft-deleted adjustments are excluded from the math', () => {
    const adjustments: CostAdjustment[] = [
      { bucket: 'soft_cost', amount: 250 },
      { bucket: 'soft_cost', amount: 9999, deleted_at: '2026-06-25T01:00:00Z' }, // deleted
    ];
    const r = computeAdjustedMargin(job(), adjustments);
    expect(r.manualAdjustmentTotal).toBe(250);
    expect(r.adjustedTotalCost).toBe(5750);
  });

  it('zero revenue: GM% is null (no divide-by-zero)', () => {
    const r = computeAdjustedMargin(job({ st_revenue: 0 }), []);
    expect(r.revenue).toBe(0);
    expect(r.adjustedGrossMargin).toBe(-5500);
    expect(r.adjustedGrossMarginPct).toBeNull();
  });

  it('no cost data yet: margin is null, not a zero-cost inflated number', () => {
    const r = computeAdjustedMargin(
      job({ costs_synced_at: null, st_total_cost: null, st_revenue: null }),
      []
    );
    expect(r.hasCostData).toBe(false);
    expect(r.revenue).toBeNull();
    expect(r.adjustedTotalCost).toBeNull();
    expect(r.adjustedGrossMargin).toBeNull();
    expect(r.adjustedGrossMarginPct).toBeNull();
  });

  it('stOtherCost captures ST cost beyond the three visible buckets (PO/returns)', () => {
    // ST total 6000 but visible buckets sum to 5500 → 500 of PO/return cost.
    const r = computeAdjustedMargin(job({ st_total_cost: 6000 }), []);
    expect(r.stOtherCost).toBe(500);
    // displayed buckets + other + contractor + manual reconcile to adjustedTotalCost
    const reconciled =
      r.equipmentCost + r.materialCost + r.laborCost + r.softCost + r.overheadCost + r.stOtherCost;
    expect(reconciled).toBeCloseTo(r.adjustedTotalCost as number, 6);
  });
});
