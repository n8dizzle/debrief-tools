-- Estimate Tool: Tier configuration table
-- Stores per-tier settings (warranties, financing, guarantees, features)
-- Editable by managers/owners via /settings/tiers

CREATE TABLE IF NOT EXISTS estimate_tier_configs (
  id TEXT PRIMARY KEY,                    -- 'builder', 'silver', 'gold', 'platinum', 'platinum_plus'
  display_name TEXT NOT NULL,             -- 'Builder', 'Silver', etc.
  sort_order INT NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#6B7280',  -- accent hex color
  default_brand TEXT NOT NULL DEFAULT 'American Standard',

  -- Warranties
  labor_warranty_years INT NOT NULL DEFAULT 1,
  parts_warranty_years INT NOT NULL DEFAULT 10,
  heat_exchanger_warranty_years INT NOT NULL DEFAULT 20,
  comfort_guarantee_years INT NOT NULL DEFAULT 1,

  -- System characteristics
  compressor_stage TEXT NOT NULL DEFAULT 'Single-Stage',  -- Single-Stage, Two-Stage, Variable
  noise_level TEXT NOT NULL DEFAULT 'Standard',           -- Standard, Quiet, Quieter, Quietest
  cooling_savings TEXT NOT NULL DEFAULT 'Up to 10%',
  heating_savings TEXT NOT NULL DEFAULT 'Up to 5%',

  -- Included features
  thermostat TEXT NOT NULL DEFAULT 'Basic Thermostat',
  financing_options JSONB NOT NULL DEFAULT '["18 Month 0% Interest"]'::jsonb,
  guarantees JSONB NOT NULL DEFAULT '["Property Protection"]'::jsonb,
  tech_features JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Metadata
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES portal_users(id)
);

-- Seed default tier configs
INSERT INTO estimate_tier_configs (id, display_name, sort_order, color, default_brand,
  labor_warranty_years, parts_warranty_years, heat_exchanger_warranty_years, comfort_guarantee_years,
  compressor_stage, noise_level, cooling_savings, heating_savings, thermostat,
  financing_options, guarantees, tech_features)
VALUES
  ('builder', 'Builder', 1, '#6B7280', 'Comfort Maker',
   1, 10, 20, 1,
   'Single-Stage', 'Standard', 'Up to 10%', 'Up to 5%', 'Basic Thermostat',
   '["18 Month 0% Interest"]',
   '["Property Protection"]',
   '["Basic Thermostat"]'),

  ('silver', 'Silver', 2, '#2563EB', 'American Standard',
   2, 10, 20, 2,
   'Single-Stage', 'Quiet', 'Up to 15%', 'Up to 16%', 'Programmable Thermostat',
   '["18 Month 0% Interest"]',
   '["$500 No-Frustration", "Property Protection", "No-Lemon", "2-Year Satisfaction"]',
   '["Programmable Thermostat", "Upgraded Filtration", "Noise Reduction"]'),

  ('gold', 'Gold', 3, '#B8956B', 'American Standard',
   5, 10, 20, 3,
   'Two-Stage', 'Quieter', 'Up to 25%', 'Up to 15%', 'Wi-Fi Thermostat',
   '["18 Month 0% Interest"]',
   '["$500 No-Frustration", "Property Protection", "No-Lemon", "1-Year Club", "2-Year Satisfaction"]',
   '["Wi-Fi Thermostat", "Smartphone Control", "Upgraded Filtration", "UV Germicidal Light", "Variable-Speed Blower"]'),

  ('platinum', 'Platinum', 4, '#7C3AED', 'American Standard',
   10, 10, 20, 5,
   'Variable', 'Quietest', 'Up to 35%', 'Up to 18%', 'Wi-Fi Thermostat',
   '["18 Month 0% Interest", "60 Month 0% Interest"]',
   '["$500 No-Frustration", "Property Protection", "No-Lemon", "1-Year Club", "2-Year Satisfaction"]',
   '["Wi-Fi Thermostat", "Increased Humidity Control", "Smartphone Control", "Top-of-the-Line Filtration", "UV Germicidal Light", "Variable-Speed Technology"]'),

  ('platinum_plus', 'Platinum+', 5, '#4F46E5', 'American Standard',
   10, 10, 20, 5,
   'Variable', 'Quietest', 'Up to 35%', 'Up to 18%', 'Wi-Fi Thermostat',
   '["18 Month 0% Interest", "60 Month 0% Interest"]',
   '["$500 No-Frustration", "Property Protection", "No-Lemon", "1-Year Club", "2-Year Satisfaction"]',
   '["Wi-Fi Thermostat", "Increased Humidity Control", "Smartphone Control", "Top-of-the-Line Filtration", "UV Germicidal Light", "Variable-Speed Technology"]')

ON CONFLICT (id) DO NOTHING;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_estimate_tier_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_estimate_tier_configs_updated_at
  BEFORE UPDATE ON estimate_tier_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_estimate_tier_configs_updated_at();
