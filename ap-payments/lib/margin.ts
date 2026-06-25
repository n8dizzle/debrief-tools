/**
 * Adjusted gross margin computation for AP Payments.
 *
 * ServiceTitan's gross margin is overstated on subcontracted installs: ST only sees in-house
 * labor, so a subbed job shows almost no labor cost and an inflated margin. This module layers
 * the real costs AP knows about (the contractor payment) plus manual per-invoice adjustments
 * on top of ST's numbers to produce a "true" adjusted margin.
 *
 * Revenue is the ST report's TotalRevenue (st_revenue), NOT ap_install_jobs.job_total — ~46% of
 * completed jobs have job_total = 0 because revenue lives on the invoice, not the job.
 *
 * Cost model
 * ──────────
 *   adjustedTotalCost = st_total_cost                 (ST's full cost: equip + material + labor
 *                                                       + PO + returns, as ST computed it)
 *                     + contractorLabor               (contractor jobs only: live payment_amount,
 *                                                       added on top of ST's near-zero subbed labor)
 *                     + Σ manual adjustments          (signed: + adds cost, − corrects down)
 *
 *   adjustedGrossMargin    = revenue − adjustedTotalCost
 *   adjustedGrossMarginPct = revenue > 0 ? adjustedGrossMargin / revenue : null   (fraction)
 *
 * Per assignment_type
 * ───────────────────
 *   contractor          → contractorLabor = payment_amount (live); ST labor ≈ 0 on subbed jobs
 *   in_house            → contractorLabor = 0; ST's st_labor_cost is the labor source of truth.
 *                         (ap_install_jobs.labor_cost is deliberately NOT used — it's unreliable.)
 *   unassigned/other    → contractorLabor = 0; ST cost + manual adjustments only
 *
 * The per-bucket breakdown (equipment/material/labor/...) is for display/transparency. The
 * authoritative adjusted total is anchored on st_total_cost (which can exceed the three visible
 * buckets because ST includes PO/return costs) so nothing is silently dropped. stOtherCost
 * captures the difference so the displayed buckets reconcile to the total.
 */

export type Bucket = 'equipment' | 'material' | 'labor' | 'soft_cost' | 'overhead';

export interface CostAdjustment {
  bucket: Bucket;
  amount: number; // signed
  deleted_at?: string | null;
}

export interface MarginJobInput {
  assignment_type: string | null;
  payment_amount: number | null; // contractor payment (live source of truth)
  st_revenue: number | null;
  st_equipment_cost: number | null;
  st_material_cost: number | null;
  st_labor_cost: number | null;
  st_total_cost: number | null;
  st_gross_margin: number | null;
  st_gross_margin_pct: number | null; // fraction
  costs_synced_at: string | null;
}

export interface MarginResult {
  /** True once ST cost buckets have been synced for this job. When false, callers should show
   *  "costs pending" / "—" rather than a (wrong, zero-cost) margin. */
  hasCostData: boolean;
  revenue: number | null;

  // ST passthrough (for the ST-vs-adjusted delta)
  stTotalCost: number | null;
  stGrossMargin: number | null;
  stGrossMarginPct: number | null; // fraction

  // Per-bucket adjusted totals (ST value + adjustments; labor also includes contractorLabor)
  equipmentCost: number;
  materialCost: number;
  laborCost: number;
  softCost: number;
  overheadCost: number;
  /** ST cost not attributable to the three visible buckets (PO costs, returns, etc.). Keeps the
   *  displayed buckets reconciling to adjustedTotalCost. */
  stOtherCost: number;

  /** The contractor payment portion of laborCost (0 for non-contractor jobs). */
  contractorLabor: number;
  /** Sum of all active manual adjustments (signed). */
  manualAdjustmentTotal: number;

  adjustedTotalCost: number | null;
  adjustedGrossMargin: number | null;
  adjustedGrossMarginPct: number | null; // fraction
}

function num(v: number | null | undefined): number {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

/**
 * Compute the adjusted gross margin for a single job. Pure function — no I/O.
 * `adjustments` should already be the ACTIVE rows for this job, but soft-deleted rows are
 * defensively excluded here too.
 */
export function computeAdjustedMargin(
  job: MarginJobInput,
  adjustments: CostAdjustment[] = []
): MarginResult {
  const hasCostData = job.costs_synced_at != null && job.st_total_cost != null;
  const revenue = hasCostData ? num(job.st_revenue) : null;

  const active = adjustments.filter((a) => !a.deleted_at);
  const byBucket = (b: Bucket) =>
    active.filter((a) => a.bucket === b).reduce((s, a) => s + num(a.amount), 0);

  const contractorLabor = job.assignment_type === 'contractor' ? num(job.payment_amount) : 0;
  const manualAdjustmentTotal = active.reduce((s, a) => s + num(a.amount), 0);

  const stEquip = num(job.st_equipment_cost);
  const stMaterial = num(job.st_material_cost);
  const stLabor = num(job.st_labor_cost);
  const stTotal = num(job.st_total_cost);

  const equipmentCost = stEquip + byBucket('equipment');
  const materialCost = stMaterial + byBucket('material');
  const laborCost = stLabor + contractorLabor + byBucket('labor');
  const softCost = byBucket('soft_cost');
  const overheadCost = byBucket('overhead');
  // Whatever ST counted in TotalCosts beyond the three visible buckets (PO, returns, ...).
  const stOtherCost = stTotal - (stEquip + stMaterial + stLabor);

  if (!hasCostData) {
    return {
      hasCostData: false,
      revenue: null,
      stTotalCost: job.st_total_cost,
      stGrossMargin: job.st_gross_margin,
      stGrossMarginPct: job.st_gross_margin_pct,
      equipmentCost,
      materialCost,
      laborCost,
      softCost,
      overheadCost,
      stOtherCost,
      contractorLabor,
      manualAdjustmentTotal,
      adjustedTotalCost: null,
      adjustedGrossMargin: null,
      adjustedGrossMarginPct: null,
    };
  }

  const adjustedTotalCost = stTotal + contractorLabor + manualAdjustmentTotal;
  const adjustedGrossMargin = (revenue as number) - adjustedTotalCost;
  const adjustedGrossMarginPct =
    (revenue as number) > 0 ? adjustedGrossMargin / (revenue as number) : null;

  return {
    hasCostData: true,
    revenue,
    stTotalCost: job.st_total_cost,
    stGrossMargin: job.st_gross_margin,
    stGrossMarginPct: job.st_gross_margin_pct,
    equipmentCost,
    materialCost,
    laborCost,
    softCost,
    overheadCost,
    stOtherCost,
    contractorLabor,
    manualAdjustmentTotal,
    adjustedTotalCost,
    adjustedGrossMargin,
    adjustedGrossMarginPct,
  };
}
