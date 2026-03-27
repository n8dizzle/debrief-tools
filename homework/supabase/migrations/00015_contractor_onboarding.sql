-- =============================================
-- Migration 00015: Contractor Onboarding
-- =============================================
-- Adds onboarding wizard fields to contractors table,
-- business type → catalog category mapping table,
-- and market rate benchmarks table for pricing engine.

-- Add onboarding columns to contractors
ALTER TABLE contractors
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS business_types TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS years_in_business INTEGER,
  ADD COLUMN IF NOT EXISTS employee_count INTEGER,
  ADD COLUMN IF NOT EXISTS annual_revenue_target INTEGER,
  ADD COLUMN IF NOT EXISTS jobs_per_week_target INTEGER,
  ADD COLUMN IF NOT EXISTS labor_cost_pct NUMERIC(5,2) DEFAULT 35.00,
  ADD COLUMN IF NOT EXISTS materials_cost_pct NUMERIC(5,2) DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS overhead_pct NUMERIC(5,2) DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS profit_margin_pct NUMERIC(5,2) DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Business type → catalog category mapping
-- Maps high-level business types (e.g. "hvac") to the catalog categories
-- that should be included in their price book.
CREATE TABLE business_type_category_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type TEXT NOT NULL,
  category_slug TEXT NOT NULL REFERENCES catalog_categories(slug),
  UNIQUE(business_type, category_slug)
);

CREATE INDEX idx_btcm_type ON business_type_category_map(business_type);

-- Seed the business type → category mappings
INSERT INTO business_type_category_map (business_type, category_slug) VALUES
  ('lawn_landscape', 'lawn-and-turf'),
  ('lawn_landscape', 'landscaping-and-hardscaping'),
  ('fencing', 'fencing'),
  ('paving', 'driveway-and-walkways'),
  ('pool', 'pool-and-outdoor-living'),
  ('roofing', 'roofing'),
  ('siding_exterior', 'siding-exterior-walls'),
  ('windows_doors', 'windows-doors'),
  ('foundation', 'foundation'),
  ('gutters', 'gutters'),
  ('insulation', 'insulation-weatherproofing'),
  ('hvac', 'hvac'),
  ('plumbing', 'plumbing'),
  ('electrical', 'electrical'),
  ('painting_finishes', 'interior-finishes'),
  ('appliance_repair', 'appliances'),
  ('pest_control', 'pest-control');

-- DFW market rate benchmarks for catalog services
-- Used by pricing engine to generate initial price books.
-- Prices in cents. Labor/materials percentages per service type.
CREATE TABLE catalog_service_market_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES catalog_services(id) ON DELETE CASCADE,
  market TEXT NOT NULL DEFAULT 'dfw',
  low_price INTEGER NOT NULL,
  median_price INTEGER NOT NULL,
  high_price INTEGER NOT NULL,
  labor_pct NUMERIC(5,2),
  materials_pct NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, market)
);

CREATE INDEX idx_market_rates_service ON catalog_service_market_rates(service_id);
CREATE INDEX idx_market_rates_market ON catalog_service_market_rates(market);

-- RLS for market rates (public read, admin write)
ALTER TABLE catalog_service_market_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read market rates"
  ON catalog_service_market_rates FOR SELECT USING (true);

CREATE POLICY "Admins manage market rates"
  ON catalog_service_market_rates FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- RLS for business type map (public read, admin write)
ALTER TABLE business_type_category_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read business type map"
  ON business_type_category_map FOR SELECT USING (true);

CREATE POLICY "Admins manage business type map"
  ON business_type_category_map FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
