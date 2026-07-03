-- Estimate Tool: Financing plans, scope templates, default add-ons
-- Extends tier configs with new JSONB columns and adds financing_plans table

-- ── Financing Plans ──────────────────────────────────────────────
-- Stores both ServiceTitan-synced and manually configured financing options
CREATE TABLE IF NOT EXISTS estimate_financing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('servicetitan', 'manual')),
  st_plan_code TEXT,                        -- ServiceTitan plan code (nullable for manual)
  name TEXT NOT NULL,                       -- e.g. '0% for 18 Months'
  months INT NOT NULL,
  apr NUMERIC(5,2) NOT NULL DEFAULT 0,      -- e.g. 6.99
  min_amount NUMERIC(10,2) DEFAULT 0,       -- minimum financed amount
  apply_url TEXT,                           -- link to financing application
  active BOOLEAN NOT NULL DEFAULT true,
  synced_at TIMESTAMPTZ,                    -- last sync from ST (null for manual)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default financing plans (manual, matching current hardcoded terms)
INSERT INTO estimate_financing_plans (source, name, months, apr, min_amount, active)
VALUES
  ('manual', '0% for 18 Months', 18, 0, 1000, true),
  ('manual', '6.99% for 60 Months', 60, 6.99, 3000, true),
  ('manual', '7.99% for 84 Months', 84, 7.99, 5000, true),
  ('manual', '8.99% for 120 Months', 120, 8.99, 5000, true);

-- Updated_at trigger for financing plans
CREATE OR REPLACE FUNCTION update_estimate_financing_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_estimate_financing_plans_updated_at
  BEFORE UPDATE ON estimate_financing_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_estimate_financing_plans_updated_at();

-- ── Tier Config Extensions ───────────────────────────────────────
-- Add new columns for default add-ons, warranty extension, financing, scope

ALTER TABLE estimate_tier_configs
  ADD COLUMN IF NOT EXISTS default_addon_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS featured_financing_plan_id UUID REFERENCES estimate_financing_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warranty_extension_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS scope_included JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scope_excluded JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scope_assumptions JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Seed default scope templates
UPDATE estimate_tier_configs SET
  scope_included = '["All materials and labor", "City permit and inspection", "Equipment disposal and recycling", "Floor savers and drop cloths", "Complete cleanup when we leave", "Post-install quality inspection"]'::jsonb,
  scope_excluded = '["Ductwork modification or replacement", "Electrical panel upgrades", "Attic or crawl space access modifications", "Concrete or structural work", "Asbestos or mold remediation", "Smart home integration beyond thermostat"]'::jsonb,
  scope_assumptions = '["Standard residential system (5 tons or under)", "Equipment accessible without modification", "Existing electrical service is adequate", "Standard refrigerant line lengths (up to 50ft)", "One system per quoted price"]'::jsonb
WHERE scope_included = '[]'::jsonb;

-- ── Cached Add-Ons (from ST Pricebook) ───────────────────────────
-- Stores add-ons synced from ServiceTitan pricebook
CREATE TABLE IF NOT EXISTS estimate_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('servicetitan', 'manual')),
  st_sku_id INT,                            -- ServiceTitan pricebook SKU ID
  st_code TEXT,                             -- ServiceTitan pricebook code
  st_type TEXT,                             -- 'Service' | 'Material' | 'Equipment'
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',   -- indoor-air-quality, comfort, protection, smart-home
  popular BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updated_at trigger for addons
CREATE TRIGGER trg_estimate_addons_updated_at
  BEFORE UPDATE ON estimate_addons
  FOR EACH ROW
  EXECUTE FUNCTION update_estimate_financing_plans_updated_at();
