-- AP Payments: Adjusted Gross Margin view
-- Adds ServiceTitan cost-bucket columns to ap_install_jobs (pulled from ST report 33240339)
-- and a table for manual per-invoice cost adjustments.
--
-- NOTE: revenue for margin comes from the ST report's TotalRevenue (st_revenue), NOT job_total
-- (~46% of completed jobs have job_total = 0 because revenue lives on the invoice, not the job).

-- --- ServiceTitan cost buckets on the job (synced from report 33240339 by job_number) ---
ALTER TABLE ap_install_jobs
  ADD COLUMN IF NOT EXISTS st_revenue          NUMERIC(12,2),  -- report TotalRevenue (margin revenue source of truth)
  ADD COLUMN IF NOT EXISTS st_equipment_cost   NUMERIC(12,2),  -- report EquipmentCosts
  ADD COLUMN IF NOT EXISTS st_material_cost    NUMERIC(12,2),  -- report MaterialTotals
  ADD COLUMN IF NOT EXISTS st_labor_cost       NUMERIC(12,2),  -- report LaborPay
  ADD COLUMN IF NOT EXISTS st_total_cost       NUMERIC(12,2),  -- report TotalCosts
  ADD COLUMN IF NOT EXISTS st_gross_margin     NUMERIC(12,2),  -- report GrossMargin ($)
  ADD COLUMN IF NOT EXISTS st_gross_margin_pct NUMERIC(7,4),   -- report GrossMarginPercentage (decimal fraction, 0.6956 = 69.56%)
  ADD COLUMN IF NOT EXISTS costs_synced_at     TIMESTAMPTZ;    -- when cost buckets were last pulled from ST

-- Period filter index (margin grid filters by completed_date; existing indexes don't cover it)
CREATE INDEX IF NOT EXISTS idx_ap_install_jobs_completed ON ap_install_jobs(completed_date);

-- --- Manual per-invoice cost adjustments ---
-- Layered on top of ST costs to compute "true" adjusted margin. Manual rows only:
-- the contractor payment is NOT stored here (it's computed at read time from payment_amount).
CREATE TABLE IF NOT EXISTS ap_cost_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES ap_install_jobs(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL CHECK (bucket IN ('equipment','material','labor','soft_cost','overhead')),
  amount NUMERIC(12,2) NOT NULL,          -- signed: positive adds cost, negative removes/corrects down
  label TEXT,                             -- e.g. "permit", "crane rental"
  source TEXT NOT NULL DEFAULT 'manual',  -- 'manual' (Phase 1); 'overhead_auto' reserved for the rules engine
  note TEXT,
  deleted_at TIMESTAMPTZ,                 -- soft delete (preserve audit trail)
  created_by UUID REFERENCES portal_users(id),
  updated_by UUID REFERENCES portal_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active adjustments per job (the hot path for /api/margin)
CREATE INDEX IF NOT EXISTS idx_ap_cost_adjustments_job
  ON ap_cost_adjustments(job_id) WHERE deleted_at IS NULL;
