-- New Customers table
-- Stores customer data from ServiceTitan for heat map and analytics.
-- Run this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS new_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ServiceTitan fields
  st_customer_id TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  created_on DATE NOT NULL,
  customer_type TEXT NOT NULL DEFAULT 'Residential',  -- Residential or Commercial
  member_status TEXT DEFAULT 'Inactive',
  original_campaign TEXT,
  created_by TEXT,
  city TEXT,
  full_address TEXT,

  -- Revenue
  completed_revenue NUMERIC(12,2) DEFAULT 0,
  total_sales NUMERIC(12,2) DEFAULT 0,
  lifetime_revenue NUMERIC(12,2) DEFAULT 0,
  completed_jobs INTEGER DEFAULT 0,
  last_job_completed DATE,

  -- Geocoding
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  geocoded_at TIMESTAMPTZ,

  -- Metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_new_customers_created_on ON new_customers(created_on);
CREATE INDEX IF NOT EXISTS idx_new_customers_city ON new_customers(city);
CREATE INDEX IF NOT EXISTS idx_new_customers_campaign ON new_customers(original_campaign);
CREATE INDEX IF NOT EXISTS idx_new_customers_type ON new_customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_new_customers_geocoded ON new_customers(lat, lng) WHERE lat IS NOT NULL;
