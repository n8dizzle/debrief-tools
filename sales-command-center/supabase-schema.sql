-- Christmas Air & Plumbing Dashboard - Supabase Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Comfort Advisors table
CREATE TABLE IF NOT EXISTS comfort_advisors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  avatar TEXT,
  active BOOLEAN DEFAULT true,
  in_queue BOOLEAN DEFAULT true,
  tgl_queue_position INT DEFAULT 1,
  marketed_queue_position INT DEFAULT 1,
  sales_mtd DECIMAL DEFAULT 0,
  closing_rate DECIMAL DEFAULT 0,
  total_leads INT DEFAULT 0,
  sold_leads INT DEFAULT 0,
  service_titan_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add service_titan_id column if it doesn't exist (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comfort_advisors' AND column_name = 'service_titan_id'
  ) THEN
    ALTER TABLE comfort_advisors ADD COLUMN service_titan_id TEXT UNIQUE;
  END IF;
END $$;

-- Add new sales metrics columns (average_sale, sales_opps)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comfort_advisors' AND column_name = 'average_sale'
  ) THEN
    ALTER TABLE comfort_advisors ADD COLUMN average_sale DECIMAL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comfort_advisors' AND column_name = 'sales_opps'
  ) THEN
    ALTER TABLE comfort_advisors ADD COLUMN sales_opps INT DEFAULT 0;
  END IF;
END $$;

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name TEXT NOT NULL,
  lead_type TEXT NOT NULL CHECK (lead_type IN ('TGL', 'Marketed')),
  source TEXT,
  tech_name TEXT,
  status TEXT DEFAULT 'New Lead' CHECK (status IN ('New Lead', 'Assigned', 'Quoted', 'Sold', 'Install Scheduled', 'Completed')),
  assigned_advisor_id UUID REFERENCES comfort_advisors(id) ON DELETE SET NULL,
  estimated_value DECIMAL DEFAULT 0,
  gross_margin_percent DECIMAL DEFAULT 40,
  gross_margin_dollar DECIMAL DEFAULT 0,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  service_titan_id TEXT UNIQUE,
  service_titan_customer_id TEXT,     -- ST customer ID, used for install job detection
  unit_age INT,
  system_type TEXT CHECK (system_type IS NULL OR system_type IN ('Gas', 'Heat Pump', 'Unknown')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Service Titan config (single row)
CREATE TABLE IF NOT EXISTS service_titan_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  app_key TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  environment TEXT DEFAULT 'production' CHECK (environment IN ('production', 'integration')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_lead_type ON leads(lead_type);
CREATE INDEX IF NOT EXISTS idx_leads_service_titan_id ON leads(service_titan_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_advisor ON leads(assigned_advisor_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advisors_active ON comfort_advisors(active);

-- Row Level Security (RLS) policies
-- For now, allow all operations (can be tightened later with auth)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE comfort_advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_titan_config ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated and anon users (development mode)
CREATE POLICY "Allow all operations on leads" ON leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on comfort_advisors" ON comfort_advisors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on service_titan_config" ON service_titan_config FOR ALL USING (true) WITH CHECK (true);

-- Function to update advisor queue positions after assignment
CREATE OR REPLACE FUNCTION rotate_queue_positions(
  p_advisor_id UUID,
  p_queue_type TEXT
)
RETURNS void AS $$
DECLARE
  v_current_position INT;
  v_max_position INT;
BEGIN
  IF p_queue_type = 'tgl' THEN
    SELECT tgl_queue_position INTO v_current_position
    FROM comfort_advisors WHERE id = p_advisor_id;

    SELECT MAX(tgl_queue_position) INTO v_max_position
    FROM comfort_advisors WHERE active = true;

    -- Move assigned advisor to back of queue
    UPDATE comfort_advisors SET tgl_queue_position = v_max_position WHERE id = p_advisor_id;

    -- Move everyone else up
    UPDATE comfort_advisors
    SET tgl_queue_position = tgl_queue_position - 1
    WHERE tgl_queue_position > 1
    AND id != p_advisor_id
    AND active = true;
  ELSE
    SELECT marketed_queue_position INTO v_current_position
    FROM comfort_advisors WHERE id = p_advisor_id;

    SELECT MAX(marketed_queue_position) INTO v_max_position
    FROM comfort_advisors WHERE active = true;

    -- Move assigned advisor to back of queue
    UPDATE comfort_advisors SET marketed_queue_position = v_max_position WHERE id = p_advisor_id;

    -- Move everyone else up
    UPDATE comfort_advisors
    SET marketed_queue_position = marketed_queue_position - 1
    WHERE marketed_queue_position > 1
    AND id != p_advisor_id
    AND active = true;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Sample data for testing (optional - uncomment to use)
/*
INSERT INTO comfort_advisors (name, email, phone, tgl_queue_position, marketed_queue_position) VALUES
  ('Luke Sage', 'lukesage@sky.com', '(972) 800-7225', 1, 1),
  ('Brett Sutherland', 'brett@christmasair.com', '(214) 701-5023', 2, 2);
*/
