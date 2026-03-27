-- =============================================
-- Migration 00004: Contractor System
-- =============================================

-- Contractor profiles
CREATE TABLE contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_description TEXT,
  business_phone TEXT,
  business_email TEXT,
  website_url TEXT,
  logo_url TEXT,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT DEFAULT 'TX',
  zip_code TEXT,

  -- Verification
  license_number TEXT,
  insurance_verified BOOLEAN DEFAULT FALSE,
  background_check_passed BOOLEAN DEFAULT FALSE,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'under_review', 'approved', 'rejected', 'suspended')),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES user_profiles(id),

  -- Stripe Connect
  stripe_account_id TEXT,
  stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
  stripe_charges_enabled BOOLEAN DEFAULT FALSE,
  stripe_payouts_enabled BOOLEAN DEFAULT FALSE,

  -- Ratings (denormalized aggregates)
  rating_overall NUMERIC(3,2) DEFAULT 0,
  rating_quality NUMERIC(3,2) DEFAULT 0,
  rating_punctuality NUMERIC(3,2) DEFAULT 0,
  rating_communication NUMERIC(3,2) DEFAULT 0,
  rating_value NUMERIC(3,2) DEFAULT 0,
  rating_cleanliness NUMERIC(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,

  -- Stats
  jobs_completed INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0, -- cents
  member_since TIMESTAMPTZ DEFAULT NOW(),

  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contractors_user ON contractors(user_id);
CREATE INDEX idx_contractors_status ON contractors(verification_status);
CREATE INDEX idx_contractors_stripe ON contractors(stripe_account_id);
CREATE INDEX idx_contractors_active ON contractors(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_contractors_rating ON contractors(rating_overall DESC);

-- Contractor trades (which departments they serve)
CREATE TABLE contractor_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES catalog_departments(id),
  years_experience INTEGER,
  is_primary BOOLEAN DEFAULT FALSE,
  UNIQUE(contractor_id, department_id)
);

CREATE INDEX idx_contractor_trades_contractor ON contractor_trades(contractor_id);
CREATE INDEX idx_contractor_trades_dept ON contractor_trades(department_id);

-- Service areas (zip codes a contractor covers)
CREATE TABLE contractor_service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  zip_code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(contractor_id, zip_code)
);

CREATE INDEX idx_contractor_areas_contractor ON contractor_service_areas(contractor_id);
CREATE INDEX idx_contractor_areas_zip ON contractor_service_areas(zip_code);

-- Contractor prices per catalog service
CREATE TABLE contractor_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES catalog_services(id) ON DELETE CASCADE,
  base_price INTEGER NOT NULL, -- cents
  -- Variable pricing overrides: { "variable_id": { "option_value": price_in_cents } }
  variable_pricing JSONB DEFAULT '{}',
  -- Addon pricing overrides: { "addon_id": price_in_cents }
  addon_pricing JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT, -- internal notes for contractor
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contractor_id, service_id)
);

CREATE INDEX idx_contractor_prices_contractor ON contractor_prices(contractor_id);
CREATE INDEX idx_contractor_prices_service ON contractor_prices(service_id);

-- Contractor availability (weekly schedule)
CREATE TABLE contractor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  UNIQUE(contractor_id, day_of_week)
);

CREATE INDEX idx_contractor_availability_contractor ON contractor_availability(contractor_id);

-- Blocked dates (holidays, vacations)
CREATE TABLE contractor_blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason TEXT,
  UNIQUE(contractor_id, blocked_date)
);

CREATE INDEX idx_contractor_blocked_contractor ON contractor_blocked_dates(contractor_id);
CREATE INDEX idx_contractor_blocked_date ON contractor_blocked_dates(blocked_date);

-- Daily capacity limits
CREATE TABLE contractor_daily_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  max_bookings INTEGER NOT NULL DEFAULT 4,
  UNIQUE(contractor_id, day_of_week)
);

-- Updated_at triggers
CREATE TRIGGER update_contractors_updated_at
  BEFORE UPDATE ON contractors FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_contractor_prices_updated_at
  BEFORE UPDATE ON contractor_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_daily_capacity ENABLE ROW LEVEL SECURITY;

-- Public read for approved contractors (marketplace browsing)
CREATE POLICY "Public read approved contractors"
  ON contractors FOR SELECT
  USING (verification_status = 'approved' AND is_active = TRUE);

-- Contractors can read/update their own data
CREATE POLICY "Contractors manage own profile"
  ON contractors FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Contractors manage own trades"
  ON contractor_trades FOR ALL
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid()));

CREATE POLICY "Contractors manage own areas"
  ON contractor_service_areas FOR ALL
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid()));

CREATE POLICY "Contractors manage own prices"
  ON contractor_prices FOR ALL
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid()));

-- Public read for active contractor prices (price comparison)
CREATE POLICY "Public read active prices"
  ON contractor_prices FOR SELECT
  USING (
    is_active = TRUE AND
    contractor_id IN (SELECT id FROM contractors WHERE verification_status = 'approved' AND is_active = TRUE)
  );

CREATE POLICY "Contractors manage own availability"
  ON contractor_availability FOR ALL
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid()));

CREATE POLICY "Contractors manage own blocked dates"
  ON contractor_blocked_dates FOR ALL
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid()));

CREATE POLICY "Contractors manage own capacity"
  ON contractor_daily_capacity FOR ALL
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid()));

-- Public read for availability (booking flow)
CREATE POLICY "Public read availability"
  ON contractor_availability FOR SELECT USING (true);

CREATE POLICY "Public read blocked dates"
  ON contractor_blocked_dates FOR SELECT USING (true);

CREATE POLICY "Public read capacity"
  ON contractor_daily_capacity FOR SELECT USING (true);

-- Admin full access
CREATE POLICY "Admins manage contractors"
  ON contractors FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage trades"
  ON contractor_trades FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage areas"
  ON contractor_service_areas FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage prices"
  ON contractor_prices FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage availability"
  ON contractor_availability FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage blocked dates"
  ON contractor_blocked_dates FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage capacity"
  ON contractor_daily_capacity FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
