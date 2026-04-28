-- Inventory templates — par-stock lists per warehouse, mirrored from
-- ServiceTitan when the integration app has the inventory-templates scope.
-- Useful for restock-batch generation and shortage reporting.

CREATE TABLE IF NOT EXISTS inventory_templates (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  st_template_id  VARCHAR(64)  UNIQUE,        -- nullable: locally-created templates
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  raw_st_data     JSONB,
  st_last_synced  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_template_items (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      UUID         NOT NULL REFERENCES inventory_templates(id) ON DELETE CASCADE,
  material_id      UUID         REFERENCES materials(id),     -- nullable until material syncs
  st_sku_id        VARCHAR(64),                                -- ST pricebook id, for late-binding
  target_quantity  NUMERIC      NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT inv_tmpl_item_unique UNIQUE NULLS NOT DISTINCT (template_id, st_sku_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_tmpl_items_template_id  ON inventory_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_inv_tmpl_items_material_id  ON inventory_template_items(material_id);

-- Link warehouses to their template (1-to-1 in ST; 1-to-many possible locally).
ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS st_inventory_template_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_warehouses_st_template ON warehouses(st_inventory_template_id);
