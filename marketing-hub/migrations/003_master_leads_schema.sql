-- Master Leads Dashboard Schema
-- Unified lead attribution tracking across all sources
-- Run this in Supabase SQL Editor

-- ============================================
-- ST_CALLS: ServiceTitan Calls Cache
-- ============================================
CREATE TABLE IF NOT EXISTS st_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ServiceTitan identifiers
  st_call_id TEXT NOT NULL UNIQUE,

  -- Call details
  direction TEXT NOT NULL,  -- Inbound, Outbound
  call_type TEXT,  -- Unbooked, Booked, Excused, etc.
  duration_seconds INTEGER,

  -- Customer/Job linkage
  customer_id BIGINT,
  job_id BIGINT,
  booking_id BIGINT,

  -- Phone numbers (for matching)
  from_phone TEXT,
  to_phone TEXT,
  tracking_number TEXT,

  -- Campaign/Source info from ServiceTitan
  campaign_id BIGINT,
  campaign_name TEXT,

  -- Agent info
  agent_id BIGINT,
  agent_name TEXT,

  -- Call recording
  recording_url TEXT,

  -- Business context
  business_unit_id BIGINT,
  business_unit_name TEXT,

  -- Timestamps
  received_at TIMESTAMPTZ NOT NULL,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for call matching and queries
CREATE INDEX IF NOT EXISTS idx_st_calls_received_at ON st_calls(received_at);
CREATE INDEX IF NOT EXISTS idx_st_calls_from_phone ON st_calls(from_phone);
CREATE INDEX IF NOT EXISTS idx_st_calls_tracking_number ON st_calls(tracking_number);
CREATE INDEX IF NOT EXISTS idx_st_calls_campaign_id ON st_calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_st_calls_customer_id ON st_calls(customer_id);
CREATE INDEX IF NOT EXISTS idx_st_calls_job_id ON st_calls(job_id);
CREATE INDEX IF NOT EXISTS idx_st_calls_direction ON st_calls(direction);

-- ============================================
-- LEAD_SOURCE_MAPPINGS: Tracking Number Mappings
-- ============================================
CREATE TABLE IF NOT EXISTS lead_source_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifier type and value
  identifier_type TEXT NOT NULL,  -- tracking_number, campaign_name, keyword
  identifier_value TEXT NOT NULL,

  -- Source attribution
  source TEXT NOT NULL,  -- lsa, gbp, website, angi, thumbtack, networx, yelp, organic, direct
  source_detail TEXT,  -- e.g., "Google LSA", "Homepage Click-to-Call"

  -- Trade categorization
  trade TEXT,  -- HVAC, Plumbing, Both

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(identifier_type, identifier_value)
);

CREATE INDEX IF NOT EXISTS idx_lead_source_mappings_identifier ON lead_source_mappings(identifier_type, identifier_value);
CREATE INDEX IF NOT EXISTS idx_lead_source_mappings_source ON lead_source_mappings(source);

-- ============================================
-- MASTER_LEADS: Unified Lead Table
-- ============================================
CREATE TABLE IF NOT EXISTS master_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identifiers (at most one should be set)
  lsa_lead_id UUID REFERENCES lsa_leads(id),
  st_call_id UUID REFERENCES st_calls(id),
  aggregator_lead_id UUID,  -- Will reference aggregator_leads when created

  -- Original source tracking
  original_source TEXT NOT NULL,  -- lsa, st_call, st_booking, website, gbp, angi, thumbtack, networx, yelp
  original_source_id TEXT,  -- The external ID from the source

  -- Attribution (may differ from original_source after reconciliation)
  primary_source TEXT NOT NULL,  -- The authoritative source for attribution
  primary_source_detail TEXT,  -- e.g., "Google LSA - HVAC", "Homepage Click-to-Call"
  source_confidence INTEGER DEFAULT 100,  -- 0-100, how confident we are in attribution

  -- Contact info (normalized)
  phone TEXT,
  phone_normalized TEXT,  -- Normalized format for matching (digits only)
  customer_name TEXT,

  -- Lead classification
  lead_type TEXT NOT NULL,  -- call, form, booking, message
  trade TEXT,  -- HVAC, Plumbing, Other

  -- Status tracking
  lead_status TEXT NOT NULL DEFAULT 'new',  -- new, contacted, qualified, booked, completed, lost, invalid
  is_qualified BOOLEAN DEFAULT false,
  is_booked BOOLEAN DEFAULT false,
  is_completed BOOLEAN DEFAULT false,

  -- ServiceTitan linkage (filled after reconciliation)
  st_customer_id BIGINT,
  st_job_id BIGINT,
  st_booking_id BIGINT,

  -- Revenue tracking (from completed jobs)
  job_revenue NUMERIC(12,2),
  job_completed_at TIMESTAMPTZ,

  -- Cost tracking
  lead_cost NUMERIC(10,2),  -- Cost attributed to this lead

  -- Reconciliation status
  reconciliation_status TEXT DEFAULT 'pending',  -- pending, auto_matched, manual_matched, no_match, duplicate
  reconciliation_confidence INTEGER,  -- 0-100
  reconciliation_rule TEXT,  -- Which rule matched (tracking_number, phone_time, campaign, time_only)
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID,  -- User who manually reconciled (if applicable)

  -- Duplicate tracking
  is_duplicate BOOLEAN DEFAULT false,
  duplicate_of_id UUID REFERENCES master_leads(id),

  -- Timestamps
  lead_created_at TIMESTAMPTZ NOT NULL,  -- When the lead came in
  created_at TIMESTAMPTZ DEFAULT NOW(),  -- When we created this record
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for master_leads
CREATE INDEX IF NOT EXISTS idx_master_leads_lsa_lead_id ON master_leads(lsa_lead_id);
CREATE INDEX IF NOT EXISTS idx_master_leads_st_call_id ON master_leads(st_call_id);
CREATE INDEX IF NOT EXISTS idx_master_leads_phone_normalized ON master_leads(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_master_leads_lead_created_at ON master_leads(lead_created_at);
CREATE INDEX IF NOT EXISTS idx_master_leads_primary_source ON master_leads(primary_source);
CREATE INDEX IF NOT EXISTS idx_master_leads_trade ON master_leads(trade);
CREATE INDEX IF NOT EXISTS idx_master_leads_lead_status ON master_leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_master_leads_reconciliation_status ON master_leads(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_master_leads_st_job_id ON master_leads(st_job_id);
CREATE INDEX IF NOT EXISTS idx_master_leads_original_source ON master_leads(original_source);

-- ============================================
-- LEAD_RECONCILIATION_LOG: Audit Trail
-- ============================================
CREATE TABLE IF NOT EXISTS lead_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The leads involved
  master_lead_id UUID NOT NULL REFERENCES master_leads(id),
  matched_st_call_id UUID REFERENCES st_calls(id),
  matched_lsa_lead_id UUID REFERENCES lsa_leads(id),

  -- Match details
  action TEXT NOT NULL,  -- auto_match, manual_match, manual_unmatch, mark_duplicate, mark_invalid
  match_rule TEXT,  -- tracking_number, phone_time, campaign, time_only, manual
  match_confidence INTEGER,

  -- Before/after state
  previous_status TEXT,
  new_status TEXT,
  previous_source TEXT,
  new_source TEXT,

  -- Audit info
  notes TEXT,
  performed_by UUID,  -- null for auto-reconciliation
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_reconciliation_log_master_lead_id ON lead_reconciliation_log(master_lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_reconciliation_log_performed_at ON lead_reconciliation_log(performed_at);

-- ============================================
-- LEAD_COST_ENTRIES: Cost Tracking by Source
-- ============================================
CREATE TABLE IF NOT EXISTS lead_cost_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Date and source
  date DATE NOT NULL,
  source TEXT NOT NULL,  -- lsa, angi, thumbtack, networx, yelp, etc.

  -- Costs
  spend NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Optional lead count (for per-lead cost sources)
  lead_count INTEGER,

  -- Notes
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(date, source)
);

CREATE INDEX IF NOT EXISTS idx_lead_cost_entries_date ON lead_cost_entries(date);
CREATE INDEX IF NOT EXISTS idx_lead_cost_entries_source ON lead_cost_entries(source);

-- ============================================
-- AGGREGATOR_LEADS: External Platform Leads
-- (Angi, Thumbtack, Networx, Yelp)
-- ============================================
CREATE TABLE IF NOT EXISTS aggregator_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Platform info
  platform TEXT NOT NULL,  -- angi, thumbtack, networx, yelp
  platform_lead_id TEXT,  -- External ID if available

  -- Contact info
  customer_name TEXT,
  phone TEXT,
  phone_normalized TEXT,
  email TEXT,
  address TEXT,

  -- Lead details
  service_requested TEXT,
  trade TEXT,  -- HVAC, Plumbing, Other

  -- Status from platform
  platform_status TEXT,  -- varies by platform

  -- Cost
  lead_cost NUMERIC(10,2),

  -- Timestamps
  lead_created_at TIMESTAMPTZ NOT NULL,

  -- Import metadata
  import_source TEXT,  -- csv, api, manual
  import_batch_id TEXT,
  imported_by UUID,
  imported_at TIMESTAMPTZ DEFAULT NOW(),

  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(platform, platform_lead_id)
);

CREATE INDEX IF NOT EXISTS idx_aggregator_leads_platform ON aggregator_leads(platform);
CREATE INDEX IF NOT EXISTS idx_aggregator_leads_phone_normalized ON aggregator_leads(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_aggregator_leads_lead_created_at ON aggregator_leads(lead_created_at);
CREATE INDEX IF NOT EXISTS idx_aggregator_leads_trade ON aggregator_leads(trade);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE st_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_source_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_reconciliation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_cost_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregator_leads ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access for API operations)
CREATE POLICY "Service role can manage st_calls"
  ON st_calls FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage lead_source_mappings"
  ON lead_source_mappings FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage master_leads"
  ON master_leads FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage lead_reconciliation_log"
  ON lead_reconciliation_log FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage lead_cost_entries"
  ON lead_cost_entries FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage aggregator_leads"
  ON aggregator_leads FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to normalize phone numbers for matching
CREATE OR REPLACE FUNCTION normalize_phone(phone TEXT)
RETURNS TEXT AS $$
BEGIN
  IF phone IS NULL THEN
    RETURN NULL;
  END IF;
  -- Remove all non-digit characters
  RETURN regexp_replace(phone, '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-update phone_normalized on master_leads
CREATE OR REPLACE FUNCTION update_master_leads_phone_normalized()
RETURNS TRIGGER AS $$
BEGIN
  NEW.phone_normalized := normalize_phone(NEW.phone);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_master_leads_phone_normalized ON master_leads;
CREATE TRIGGER trigger_master_leads_phone_normalized
  BEFORE INSERT OR UPDATE OF phone ON master_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_master_leads_phone_normalized();

-- Trigger to auto-update phone_normalized on aggregator_leads
CREATE OR REPLACE FUNCTION update_aggregator_leads_phone_normalized()
RETURNS TRIGGER AS $$
BEGIN
  NEW.phone_normalized := normalize_phone(NEW.phone);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_aggregator_leads_phone_normalized ON aggregator_leads;
CREATE TRIGGER trigger_aggregator_leads_phone_normalized
  BEFORE INSERT OR UPDATE OF phone ON aggregator_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_aggregator_leads_phone_normalized();

-- ============================================
-- VIEWS FOR DASHBOARD QUERIES
-- ============================================

-- Lead summary view with attribution and revenue
CREATE OR REPLACE VIEW v_leads_summary AS
SELECT
  ml.id,
  ml.primary_source,
  ml.primary_source_detail,
  ml.trade,
  ml.lead_type,
  ml.lead_status,
  ml.is_qualified,
  ml.is_booked,
  ml.is_completed,
  ml.phone,
  ml.customer_name,
  ml.job_revenue,
  ml.lead_cost,
  ml.lead_created_at,
  ml.reconciliation_status,
  ml.source_confidence,
  -- Calculate ROI metrics
  CASE
    WHEN ml.lead_cost > 0 THEN (COALESCE(ml.job_revenue, 0) / ml.lead_cost)
    ELSE NULL
  END as roi_ratio,
  -- Timestamps
  ml.created_at,
  ml.updated_at
FROM master_leads ml
WHERE ml.is_duplicate = false;

-- Daily lead metrics by source
CREATE OR REPLACE VIEW v_daily_lead_metrics AS
SELECT
  DATE(ml.lead_created_at) as date,
  ml.primary_source,
  ml.trade,
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE ml.is_qualified) as qualified_leads,
  COUNT(*) FILTER (WHERE ml.is_booked) as booked_leads,
  COUNT(*) FILTER (WHERE ml.is_completed) as completed_leads,
  SUM(ml.job_revenue) as total_revenue,
  SUM(ml.lead_cost) as total_cost,
  CASE
    WHEN SUM(ml.lead_cost) > 0 THEN SUM(ml.lead_cost) / COUNT(*)
    ELSE 0
  END as cpa
FROM master_leads ml
WHERE ml.is_duplicate = false
GROUP BY DATE(ml.lead_created_at), ml.primary_source, ml.trade;
