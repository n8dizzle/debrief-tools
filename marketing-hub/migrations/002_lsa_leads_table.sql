-- LSA Leads table to cache lead data from Google Ads API
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS lsa_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Google Ads identifiers
  google_lead_id TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,  -- Google Ads account ID

  -- Lead details
  lead_type TEXT NOT NULL,  -- PHONE_CALL, MESSAGE, BOOKING
  category_id TEXT,  -- xcat:service_area_business_hvac, etc.
  service_id TEXT,
  trade TEXT,  -- HVAC, Plumbing, Other (derived from category_id)

  -- Contact info (may be null for privacy)
  phone_number TEXT,
  consumer_phone_number TEXT,

  -- Status
  lead_status TEXT NOT NULL,  -- NEW, ACTIVE, BOOKED, DECLINED, EXPIRED
  lead_charged BOOLEAN NOT NULL DEFAULT false,

  -- Credit details
  credit_state TEXT,
  credit_state_updated_at TIMESTAMPTZ,

  -- Timestamps
  lead_created_at TIMESTAMPTZ NOT NULL,
  locale TEXT,

  -- Conversation details (populated separately if available)
  call_duration_seconds INTEGER,
  call_recording_url TEXT,
  message_text TEXT,

  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_lsa_leads_customer_id ON lsa_leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_lsa_leads_trade ON lsa_leads(trade);
CREATE INDEX IF NOT EXISTS idx_lsa_leads_lead_charged ON lsa_leads(lead_charged);
CREATE INDEX IF NOT EXISTS idx_lsa_leads_lead_created_at ON lsa_leads(lead_created_at);
CREATE INDEX IF NOT EXISTS idx_lsa_leads_lead_type ON lsa_leads(lead_type);

-- LSA Daily Performance cache (for campaign-level metrics)
CREATE TABLE IF NOT EXISTS lsa_daily_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id TEXT NOT NULL,
  customer_name TEXT,
  date DATE NOT NULL,

  -- Metrics from campaign data
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,  -- Store in micros, divide by 1M for dollars
  phone_calls INTEGER DEFAULT 0,
  all_conversions NUMERIC(10,2) DEFAULT 0,

  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_id, date)
);

CREATE INDEX IF NOT EXISTS idx_lsa_daily_performance_date ON lsa_daily_performance(date);
CREATE INDEX IF NOT EXISTS idx_lsa_daily_performance_customer_id ON lsa_daily_performance(customer_id);

-- LSA Accounts reference table
CREATE TABLE IF NOT EXISTS lsa_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE lsa_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lsa_daily_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE lsa_accounts ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for API operations)
CREATE POLICY "Service role can manage lsa_leads"
  ON lsa_leads FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage lsa_daily_performance"
  ON lsa_daily_performance FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage lsa_accounts"
  ON lsa_accounts FOR ALL
  USING (true)
  WITH CHECK (true);
