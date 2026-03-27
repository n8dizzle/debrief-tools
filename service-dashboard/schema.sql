-- Service Dashboard Tables
-- Run this in Supabase SQL Editor

-- Technicians synced from ServiceTitan (service BUs only)
CREATE TABLE IF NOT EXISTS sd_technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_technician_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  business_unit_id INTEGER,
  business_unit_name TEXT,
  trade TEXT NOT NULL CHECK (trade IN ('hvac', 'plumbing')),
  team_member_id UUID REFERENCES team_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sd_technicians_st_id ON sd_technicians(st_technician_id);
CREATE INDEX IF NOT EXISTS idx_sd_technicians_active ON sd_technicians(is_active);

-- Completed service jobs with tech assignment and revenue
CREATE TABLE IF NOT EXISTS sd_completed_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_job_id INTEGER NOT NULL UNIQUE,
  st_technician_id INTEGER NOT NULL,
  job_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  completed_date DATE NOT NULL,
  business_unit_name TEXT,
  trade TEXT NOT NULL CHECK (trade IN ('hvac', 'plumbing')),
  customer_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sd_jobs_tech ON sd_completed_jobs(st_technician_id);
CREATE INDEX IF NOT EXISTS idx_sd_jobs_date ON sd_completed_jobs(completed_date);

-- Sold estimates (for "Sales" / closed opportunities metric)
CREATE TABLE IF NOT EXISTS sd_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_estimate_id INTEGER NOT NULL UNIQUE,
  st_job_id INTEGER,
  sold_by_id INTEGER NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sold_on DATE NOT NULL,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sd_estimates_sold_by ON sd_estimates(sold_by_id);
CREATE INDEX IF NOT EXISTS idx_sd_estimates_date ON sd_estimates(sold_on);
CREATE INDEX IF NOT EXISTS idx_sd_estimates_job ON sd_estimates(st_job_id);

-- Tech-generated leads (TGLs / "Leads Set") from CRM API
CREATE TABLE IF NOT EXISTS sd_tgl_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_lead_id INTEGER NOT NULL UNIQUE,
  created_by_id INTEGER NOT NULL,
  source_job_id INTEGER,
  customer_name TEXT,
  status TEXT,
  created_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sd_tgl_leads_created_by ON sd_tgl_leads(created_by_id);
CREATE INDEX IF NOT EXISTS idx_sd_tgl_leads_date ON sd_tgl_leads(created_on);

-- Memberships sold by technicians
CREATE TABLE IF NOT EXISTS sd_memberships_sold (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_membership_id INTEGER NOT NULL UNIQUE,
  sold_by_id INTEGER NOT NULL,
  membership_type_name TEXT,
  sold_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sd_memberships_sold_by ON sd_memberships_sold(sold_by_id);
CREATE INDEX IF NOT EXISTS idx_sd_memberships_date ON sd_memberships_sold(sold_on);

-- Sync audit trail
CREATE TABLE IF NOT EXISTS sd_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
  technicians_synced INTEGER NOT NULL DEFAULT 0,
  jobs_synced INTEGER NOT NULL DEFAULT 0,
  leads_synced INTEGER NOT NULL DEFAULT 0,
  memberships_synced INTEGER NOT NULL DEFAULT 0,
  errors JSONB
);

CREATE INDEX IF NOT EXISTS idx_sd_sync_log_started ON sd_sync_log(started_at DESC);

-- Scoring config (single row)
CREATE TABLE IF NOT EXISTS sd_scoring_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weights JSONB NOT NULL DEFAULT '{"gross_sales": 0.40, "tgls": 0.25, "memberships_sold": 0.20, "reviews": 0.15}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

-- Insert default config
INSERT INTO sd_scoring_config (weights)
VALUES ('{"gross_sales": 0.40, "tgls": 0.25, "memberships_sold": 0.20, "reviews": 0.15}'::jsonb)
ON CONFLICT DO NOTHING;
