-- =============================================
-- Migration 00002: Markets & Geography
-- =============================================

CREATE TABLE markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  metro_area TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_miles INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE market_zip_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  zip_code TEXT NOT NULL,
  city TEXT,
  county TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(market_id, zip_code)
);

CREATE INDEX idx_market_zip_codes_zip ON market_zip_codes(zip_code);
CREATE INDEX idx_market_zip_codes_market ON market_zip_codes(market_id);

-- RLS
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_zip_codes ENABLE ROW LEVEL SECURITY;

-- Markets are public read
CREATE POLICY "Markets are public read"
  ON markets FOR SELECT
  USING (true);

CREATE POLICY "Zip codes are public read"
  ON market_zip_codes FOR SELECT
  USING (true);

-- Only admins can modify markets
CREATE POLICY "Admins can manage markets"
  ON markets FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage zip codes"
  ON market_zip_codes FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );
