-- =============================================
-- Migration 00005: Home Profiles
-- =============================================
-- Property data from ATTOM API + homeowner self-report

-- Homes
CREATE TABLE homes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Address
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'TX',
  zip_code TEXT NOT NULL,
  formatted_address TEXT, -- Google Maps formatted

  -- Geocoding
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,

  -- Property data (from ATTOM API)
  sqft INTEGER,
  lot_sqft INTEGER,
  year_built INTEGER,
  stories INTEGER,
  bedrooms INTEGER,
  bathrooms NUMERIC(3,1),
  garage_spaces INTEGER,
  property_type TEXT, -- single_family, townhouse, condo, multi_family
  roof_type TEXT,
  foundation_type TEXT, -- slab, pier_and_beam, basement
  exterior_type TEXT, -- brick, siding, stucco, stone

  -- ATTOM metadata
  attom_id TEXT,
  attom_data JSONB, -- raw API response for reference

  -- Display
  nickname TEXT, -- "My House", "Rental Property", etc.
  photo_url TEXT,
  is_primary BOOLEAN DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_homes_owner ON homes(owner_id);
CREATE INDEX idx_homes_zip ON homes(zip_code);
CREATE INDEX idx_homes_location ON homes USING gist (
  ST_SetSRID(ST_MakePoint(lng, lat), 4326)
) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Home systems (HVAC, water heater, electrical panel, etc.)
CREATE TABLE home_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  system_type TEXT NOT NULL CHECK (system_type IN (
    'hvac', 'furnace', 'water_heater', 'electrical_panel',
    'plumbing', 'roof', 'pool_equipment', 'sprinkler_system',
    'septic', 'water_softener', 'air_purifier', 'generator'
  )),
  brand TEXT,
  model TEXT,
  year_installed INTEGER,
  fuel_type TEXT, -- gas, electric, propane, heat_pump
  capacity TEXT, -- e.g., "3 ton", "50 gallon", "200 amp"
  condition TEXT CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'unknown')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_home_systems_home ON home_systems(home_id);
CREATE INDEX idx_home_systems_type ON home_systems(system_type);

-- Home features (boolean attributes for HomeFit matching)
CREATE TABLE home_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id UUID NOT NULL UNIQUE REFERENCES homes(id) ON DELETE CASCADE,

  -- Lot features
  has_pool BOOLEAN DEFAULT FALSE,
  has_sprinkler_system BOOLEAN DEFAULT FALSE,
  has_fence BOOLEAN DEFAULT FALSE,
  fence_material TEXT, -- wood, iron, chain_link, vinyl
  has_outdoor_lighting BOOLEAN DEFAULT FALSE,
  has_patio_deck BOOLEAN DEFAULT FALSE,
  has_outdoor_kitchen BOOLEAN DEFAULT FALSE,
  has_pergola BOOLEAN DEFAULT FALSE,

  -- Exterior features
  has_gutters BOOLEAN DEFAULT FALSE,
  has_gutter_guards BOOLEAN DEFAULT FALSE,

  -- Interior features
  has_gas_line BOOLEAN DEFAULT FALSE,
  has_central_hvac BOOLEAN DEFAULT FALSE,
  has_ductwork BOOLEAN DEFAULT FALSE,
  has_mini_split BOOLEAN DEFAULT FALSE,
  has_tankless_water_heater BOOLEAN DEFAULT FALSE,
  has_water_softener BOOLEAN DEFAULT FALSE,
  has_disposal BOOLEAN DEFAULT FALSE,
  has_ev_charger BOOLEAN DEFAULT FALSE,
  has_generator BOOLEAN DEFAULT FALSE,
  has_surge_protector BOOLEAN DEFAULT FALSE,
  has_radiant_barrier BOOLEAN DEFAULT FALSE,
  has_attic_insulation BOOLEAN DEFAULT FALSE,

  -- Floor types
  has_hardwood BOOLEAN DEFAULT FALSE,
  has_tile BOOLEAN DEFAULT FALSE,
  has_carpet BOOLEAN DEFAULT FALSE,
  has_lvp BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Updated_at triggers
CREATE TRIGGER update_homes_updated_at
  BEFORE UPDATE ON homes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_home_systems_updated_at
  BEFORE UPDATE ON home_systems FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_home_features_updated_at
  BEFORE UPDATE ON home_features FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE homes ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_features ENABLE ROW LEVEL SECURITY;

-- Homeowners manage their own homes
CREATE POLICY "Users manage own homes"
  ON homes FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "Users manage own home systems"
  ON home_systems FOR ALL
  USING (home_id IN (SELECT id FROM homes WHERE owner_id = auth.uid()));

CREATE POLICY "Users manage own home features"
  ON home_features FOR ALL
  USING (home_id IN (SELECT id FROM homes WHERE owner_id = auth.uid()));

-- Admin access
CREATE POLICY "Admins read homes"
  ON homes FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins read home systems"
  ON home_systems FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins read home features"
  ON home_features FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
