-- Add ServiceTitan estimate ID for dedup during sync
ALTER TABLE pe_orders ADD COLUMN IF NOT EXISTS st_estimate_id BIGINT;

-- Partial unique index: only one row per estimate ID (nulls excluded)
CREATE UNIQUE INDEX IF NOT EXISTS pe_orders_st_estimate_id_idx
  ON pe_orders(st_estimate_id)
  WHERE st_estimate_id IS NOT NULL;
