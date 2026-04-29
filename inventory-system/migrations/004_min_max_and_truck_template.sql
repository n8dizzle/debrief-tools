-- Migration 004: per-location min/max quantities + truck template assignment

-- 1. Truck template: which inventory template (par-stock list) this truck uses
ALTER TABLE trucks
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES inventory_templates(id) ON DELETE SET NULL;

-- 2. Per-location min/max on warehouse stock
ALTER TABLE warehouse_stock
  ADD COLUMN IF NOT EXISTS min_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_quantity INTEGER;

-- 3. Per-location min/max on truck stock
ALTER TABLE truck_stock
  ADD COLUMN IF NOT EXISTS min_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_quantity INTEGER;

-- Comments
COMMENT ON COLUMN trucks.template_id          IS 'Inventory template (par-stock list) assigned to this truck';
COMMENT ON COLUMN warehouse_stock.min_quantity IS 'Minimum qty trigger restock alert at this location';
COMMENT ON COLUMN warehouse_stock.max_quantity IS 'Maximum qty (fill-to level) at this location';
COMMENT ON COLUMN truck_stock.min_quantity     IS 'Minimum par level for this item on this truck (often = template target_quantity)';
COMMENT ON COLUMN truck_stock.max_quantity     IS 'Maximum qty to carry on this truck';
