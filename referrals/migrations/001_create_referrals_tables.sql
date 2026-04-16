-- Referrals: "Neighbors Helping Neighbors" program
-- All customer-facing referral tracking, reward configuration, and charity match records.

-- ============================================================================
-- REWARD CONFIGURATION (A/B-testable)
-- ============================================================================

CREATE TABLE ref_reward_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,

  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,

  -- Percent of new enrollees assigned to this variant (0-100)
  traffic_allocation NUMERIC(5,2) NOT NULL DEFAULT 100
    CHECK (traffic_allocation >= 0 AND traffic_allocation <= 100),
  experiment_group TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_admin_id UUID REFERENCES portal_users(id)
);

CREATE INDEX idx_ref_reward_configs_active ON ref_reward_configs(is_active, effective_from);
CREATE INDEX idx_ref_reward_configs_experiment ON ref_reward_configs(experiment_group);

-- Only one default config at a time
CREATE UNIQUE INDEX idx_ref_reward_configs_single_default
  ON ref_reward_configs (is_default) WHERE is_default = true;

CREATE TABLE ref_reward_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_config_id UUID NOT NULL REFERENCES ref_reward_configs(id) ON DELETE CASCADE,

  service_category TEXT NOT NULL
    CHECK (service_category IN ('SERVICE_CALL','MAINTENANCE','REPLACEMENT','COMMERCIAL')),
  service_category_label TEXT NOT NULL,

  -- Referrer reward structure
  reward_mode TEXT NOT NULL DEFAULT 'FLAT'
    CHECK (reward_mode IN ('FLAT','PERCENTAGE_OF_INVOICE','TIERED_BY_INVOICE')),
  flat_reward_amount NUMERIC(10,2),
  percentage_of_invoice NUMERIC(5,2),
  percentage_reward_cap NUMERIC(10,2),
  invoice_tier_json JSONB,

  -- Eligibility
  min_invoice_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_invoice_total NUMERIC(10,2),

  -- Referee (new customer) benefit
  referee_discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  referee_discount_type TEXT NOT NULL DEFAULT 'FLAT_OFF'
    CHECK (referee_discount_type IN ('FLAT_OFF','PERCENT_OFF','FREE_MONTH','CUSTOM')),
  referee_discount_label TEXT NOT NULL,

  -- Triple Win charity match (Christmas Air funds; does NOT reduce referrer reward)
  charity_match_mode TEXT NOT NULL DEFAULT 'PERCENTAGE'
    CHECK (charity_match_mode IN ('PERCENTAGE','FLAT','DISABLED')),
  charity_match_percent NUMERIC(5,2),
  charity_match_flat NUMERIC(10,2),
  charity_match_floor NUMERIC(10,2) NOT NULL DEFAULT 0,
  charity_match_cap NUMERIC(10,2),

  -- Workflow
  requires_admin_approval BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (reward_config_id, service_category)
);

CREATE INDEX idx_ref_reward_tiers_category ON ref_reward_tiers(service_category);

-- Change log: every edit to reward configs/tiers recorded here
CREATE TABLE ref_reward_config_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_config_id UUID REFERENCES ref_reward_configs(id) ON DELETE SET NULL,
  changed_by_admin_id UUID REFERENCES portal_users(id),
  change_type TEXT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ref_config_change_log_config ON ref_reward_config_change_log(reward_config_id);
CREATE INDEX idx_ref_config_change_log_time ON ref_reward_config_change_log(changed_at);

-- Two-admin approval requests for significant changes
CREATE TABLE ref_reward_config_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_config_id UUID REFERENCES ref_reward_configs(id) ON DELETE SET NULL,
  requested_by_admin_id UUID NOT NULL REFERENCES portal_users(id),
  change_type TEXT NOT NULL,
  proposed_change_json JSONB NOT NULL,
  impact_summary TEXT,
  requires_second_approval BOOLEAN NOT NULL DEFAULT false,
  approval_threshold TEXT,

  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','EXPIRED','APPLIED')),
  approved_by_admin_id UUID REFERENCES portal_users(id),
  approved_at TIMESTAMPTZ,
  rejected_by_admin_id UUID REFERENCES portal_users(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ref_change_requests_status ON ref_reward_config_change_requests(status);
CREATE INDEX idx_ref_change_requests_requester ON ref_reward_config_change_requests(requested_by_admin_id);

-- ============================================================================
-- CHARITIES (Triple Win)
-- ============================================================================

CREATE TABLE ref_charities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  fulfillment_method TEXT NOT NULL DEFAULT 'TREMENDOUS'
    CHECK (fulfillment_method IN ('TREMENDOUS','DIRECT_PAYMENT','POOLED_QUARTERLY')),
  tremendous_charity_id TEXT,
  ein TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ref_charities_active ON ref_charities(is_active, display_order);

-- ============================================================================
-- REFERRERS (enrolled customers)
-- ============================================================================

CREATE TABLE ref_referrers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,

  -- ServiceTitan linkage (nullable; set once matched)
  service_titan_id TEXT UNIQUE,

  -- Shareable link
  referral_code TEXT UNIQUE NOT NULL,
  referral_link TEXT UNIQUE NOT NULL,

  reward_preference TEXT NOT NULL DEFAULT 'VISA_GIFT_CARD'
    CHECK (reward_preference IN ('VISA_GIFT_CARD','AMAZON_GIFT_CARD','ACCOUNT_CREDIT','CHARITY_DONATION')),

  -- A/B test assignment (sticky)
  assigned_reward_config_id UUID REFERENCES ref_reward_configs(id),

  -- Triple Win state
  triple_win_enabled BOOLEAN NOT NULL DEFAULT false,
  selected_charity_id UUID REFERENCES ref_charities(id),

  -- Lifetime rollups
  total_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_donated_on_their_behalf NUMERIC(10,2) NOT NULL DEFAULT 0,
  lifetime_referrals INT NOT NULL DEFAULT 0,

  is_active BOOLEAN NOT NULL DEFAULT true,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ref_referrers_email ON ref_referrers(email);
CREATE INDEX idx_ref_referrers_code ON ref_referrers(referral_code);
CREATE INDEX idx_ref_referrers_config ON ref_referrers(assigned_reward_config_id);

-- ============================================================================
-- REFERRALS
-- ============================================================================

CREATE TABLE ref_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES ref_referrers(id) ON DELETE RESTRICT,

  -- Referred person
  referred_name TEXT NOT NULL,
  referred_email TEXT,
  referred_phone TEXT NOT NULL,
  referred_address TEXT,
  service_requested TEXT NOT NULL,
  notes TEXT,

  -- ServiceTitan linkage
  service_titan_lead_id TEXT UNIQUE,
  service_titan_customer_id TEXT,
  service_titan_job_id TEXT,
  service_titan_invoice_id TEXT,

  -- Financial
  invoice_total NUMERIC(10,2),
  service_category TEXT
    CHECK (service_category IN ('SERVICE_CALL','MAINTENANCE','REPLACEMENT','COMMERCIAL')),

  -- Snapshot: config + tier at submission time. Prevents mid-flight
  -- config changes from retroactively changing rewards for in-flight referrals.
  reward_config_id UUID REFERENCES ref_reward_configs(id),
  snapshot_tier_json JSONB,

  -- Triple Win snapshot
  triple_win_activated BOOLEAN NOT NULL DEFAULT false,
  snapshot_charity_id UUID REFERENCES ref_charities(id),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED','BOOKED','COMPLETED','REWARD_ISSUED','EXPIRED','INELIGIBLE')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  job_completed_at TIMESTAMPTZ,
  reward_issued_at TIMESTAMPTZ
);

CREATE INDEX idx_ref_referrals_referrer ON ref_referrals(referrer_id);
CREATE INDEX idx_ref_referrals_status ON ref_referrals(status);
CREATE INDEX idx_ref_referrals_st_customer ON ref_referrals(service_titan_customer_id);
CREATE INDEX idx_ref_referrals_config ON ref_referrals(reward_config_id);

-- ============================================================================
-- REWARDS
-- ============================================================================

CREATE TABLE ref_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID UNIQUE NOT NULL REFERENCES ref_referrals(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES ref_referrers(id) ON DELETE RESTRICT,

  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('VISA_GIFT_CARD','AMAZON_GIFT_CARD','ACCOUNT_CREDIT','CHARITY_DONATION')),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','ISSUED','DELIVERED','FAILED','CANCELLED')),

  tremendous_order_id TEXT,
  service_titan_credit_id TEXT,
  charity_name TEXT,

  issued_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failure_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ref_rewards_referrer ON ref_rewards(referrer_id);
CREATE INDEX idx_ref_rewards_status ON ref_rewards(status);

-- ============================================================================
-- CHARITY DONATIONS
-- ============================================================================

CREATE TABLE ref_charity_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID UNIQUE NOT NULL REFERENCES ref_referrals(id) ON DELETE CASCADE,
  charity_id UUID NOT NULL REFERENCES ref_charities(id) ON DELETE RESTRICT,

  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','ISSUED','CONFIRMED','FAILED')),
  fulfillment_reference TEXT,
  issued_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ref_donations_charity ON ref_charity_donations(charity_id);
CREATE INDEX idx_ref_donations_status ON ref_charity_donations(status);

-- ============================================================================
-- WEBHOOK EVENTS (idempotency + audit)
-- ============================================================================

CREATE TABLE ref_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ref_webhook_events_type ON ref_webhook_events(event_type);
CREATE INDEX idx_ref_webhook_events_processed ON ref_webhook_events(processed_at);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION ref_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ref_reward_configs_updated_at BEFORE UPDATE ON ref_reward_configs
  FOR EACH ROW EXECUTE FUNCTION ref_set_updated_at();
CREATE TRIGGER ref_reward_tiers_updated_at BEFORE UPDATE ON ref_reward_tiers
  FOR EACH ROW EXECUTE FUNCTION ref_set_updated_at();
CREATE TRIGGER ref_referrers_updated_at BEFORE UPDATE ON ref_referrers
  FOR EACH ROW EXECUTE FUNCTION ref_set_updated_at();
CREATE TRIGGER ref_rewards_updated_at BEFORE UPDATE ON ref_rewards
  FOR EACH ROW EXECUTE FUNCTION ref_set_updated_at();
