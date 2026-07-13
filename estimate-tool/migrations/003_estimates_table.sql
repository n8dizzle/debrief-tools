-- Estimates stored in Supabase (replaces localStorage)
-- Each estimate belongs to a job/customer and contains multiple tier options

CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Customer info (pulled from ST)
  customer_name TEXT NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  advisor_name TEXT NOT NULL DEFAULT '',
  advisor_id UUID REFERENCES portal_users(id),

  -- System configuration
  system_type TEXT NOT NULL DEFAULT 'ac-furnace', -- ac-furnace, heat-pump, dual-fuel, ac-only, furnace-only
  tonnage NUMERIC NOT NULL DEFAULT 3,
  system_count INT NOT NULL DEFAULT 1,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft', -- draft, presented, accepted, declined
  selected_option_id UUID,

  -- ServiceTitan refs
  st_job_id BIGINT,
  st_job_number TEXT,
  st_customer_id BIGINT,
  st_location_id BIGINT,
  st_estimate_id BIGINT, -- set after pushing to ST

  -- Curated reviews (shared across all options)
  selected_reviews JSONB DEFAULT '[]'::jsonb,

  -- Install scheduling
  install_date DATE,

  -- Notes
  notes TEXT DEFAULT '',
  existing_system TEXT DEFAULT '',

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estimate_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,

  -- Display
  label TEXT NOT NULL DEFAULT 'Option',
  sort_order INT NOT NULL DEFAULT 0,
  color TEXT, -- custom color hex override
  hidden BOOLEAN NOT NULL DEFAULT false,

  -- System (from ST pricebook)
  st_service_id BIGINT,        -- pricebook service ID
  st_service_code TEXT,         -- e.g., 5AC14-0736
  system_name TEXT NOT NULL DEFAULT '',
  system_brand TEXT NOT NULL DEFAULT 'American Standard',
  system_seer INT,
  system_stage TEXT,            -- Single-Stage, Two-Stage, Variable
  system_description TEXT,      -- ST pricebook description (has AHRI info)
  system_price NUMERIC NOT NULL DEFAULT 0,

  -- Pricing
  labor_cost NUMERIC NOT NULL DEFAULT 0,

  -- Add-ons (array of objects: id, name, description, price, category)
  add_ons JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Custom scope items (array of objects: id, name, unitCost, quantity)
  install_items JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Equipment refs from ST (for pushing back)
  equipment_refs JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_estimates_st_job_id ON estimates(st_job_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_advisor ON estimates(advisor_id);
CREATE INDEX IF NOT EXISTS idx_estimate_options_estimate ON estimate_options(estimate_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_estimates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_estimates_updated_at();

CREATE TRIGGER trg_estimate_options_updated_at
  BEFORE UPDATE ON estimate_options
  FOR EACH ROW
  EXECUTE FUNCTION update_estimates_updated_at();
