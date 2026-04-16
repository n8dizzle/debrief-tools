-- BPP Tracker Database Schema
-- Run against Supabase project: dgnsvheokdubqmdlanua

-- Categories
CREATE TABLE IF NOT EXISTS bpp_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  depreciation_type TEXT NOT NULL DEFAULT 'declining_balance' CHECK (depreciation_type IN ('declining_balance', 'straight_line', 'custom')),
  useful_life_years INTEGER NOT NULL DEFAULT 5,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed categories
INSERT INTO bpp_categories (name, description, depreciation_type, useful_life_years, sort_order) VALUES
  ('Vehicles', 'Fleet trucks, vans, and other vehicles', 'declining_balance', 7, 1),
  ('Tools & Equipment', 'Hand tools, power tools, and general equipment', 'declining_balance', 5, 2),
  ('HVAC Equipment', 'HVAC-specific equipment: recovery machines, vacuum pumps, gauges', 'declining_balance', 7, 3),
  ('Plumbing Equipment', 'Plumbing-specific equipment: cameras, jetters, locators', 'declining_balance', 5, 4),
  ('Office Furniture & Fixtures', 'Desks, chairs, shelving, warehouse fixtures', 'declining_balance', 7, 5),
  ('Computers & Electronics', 'Computers, tablets, phones, printers, network equipment', 'declining_balance', 3, 6),
  ('Leased Equipment', 'Equipment under lease agreements', 'custom', 5, 7),
  ('Inventory & Supplies', 'Parts inventory, warehouse stock', 'straight_line', 1, 8)
ON CONFLICT (name) DO NOTHING;

-- Assets
CREATE TABLE IF NOT EXISTS bpp_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES bpp_categories(id),
  description TEXT NOT NULL,
  subcategory TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost DECIMAL(12,2) NOT NULL,
  total_cost DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  year_acquired INTEGER NOT NULL,
  condition TEXT DEFAULT 'good' CHECK (condition IN ('new', 'good', 'fair', 'poor')),
  location TEXT,
  serial_number TEXT,
  notes TEXT,
  disposed BOOLEAN NOT NULL DEFAULT FALSE,
  disposed_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES portal_users(id)
);

CREATE INDEX IF NOT EXISTS idx_bpp_assets_category ON bpp_assets(category_id);
CREATE INDEX IF NOT EXISTS idx_bpp_assets_year ON bpp_assets(year_acquired);
CREATE INDEX IF NOT EXISTS idx_bpp_assets_disposed ON bpp_assets(disposed);
CREATE INDEX IF NOT EXISTS idx_bpp_assets_created_by ON bpp_assets(created_by);

-- Renditions
CREATE TABLE IF NOT EXISTS bpp_renditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_year INTEGER NOT NULL,
  county TEXT NOT NULL DEFAULT 'Harris',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'filed', 'accepted')),
  filed_date DATE,
  due_date DATE,
  extension_filed BOOLEAN NOT NULL DEFAULT FALSE,
  extension_date DATE,
  total_historical_cost DECIMAL(12,2),
  total_market_value DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES portal_users(id),
  UNIQUE(tax_year, county)
);

-- Depreciation Schedules
CREATE TABLE IF NOT EXISTS bpp_depreciation_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES bpp_categories(id),
  age_years INTEGER NOT NULL,
  depreciation_percent DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category_id, age_years)
);

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bpp_assets_updated_at ON bpp_assets;
CREATE TRIGGER bpp_assets_updated_at BEFORE UPDATE ON bpp_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS bpp_renditions_updated_at ON bpp_renditions;
CREATE TRIGGER bpp_renditions_updated_at BEFORE UPDATE ON bpp_renditions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
