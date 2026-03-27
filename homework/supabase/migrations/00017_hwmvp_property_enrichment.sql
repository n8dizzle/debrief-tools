-- Migration: Add hw-mvp property enrichment fields and tables
-- Adds Rentcast property data fields, HVAC systems, equipment tracking,
-- timeline events, homeowner preferences, and order stage tracking.

-- ============================================================
-- 1. Enrich existing homes table with Rentcast fields
-- ============================================================
ALTER TABLE homes
  ADD COLUMN IF NOT EXISTS rentcast_id text,
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS construction_type text,
  ADD COLUMN IF NOT EXISTS building_style text,
  ADD COLUMN IF NOT EXISTS cooling_type text,
  ADD COLUMN IF NOT EXISTS heating_type text,
  ADD COLUMN IF NOT EXISTS heating_fuel text,
  ADD COLUMN IF NOT EXISTS window_type text,
  ADD COLUMN IF NOT EXISTS siding_type text,
  ADD COLUMN IF NOT EXISTS pool boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fireplace boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS basement boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS attic boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS assessor_id text,
  ADD COLUMN IF NOT EXISTS tax_assessed_value integer,
  ADD COLUMN IF NOT EXISTS tax_assessed_year integer,
  ADD COLUMN IF NOT EXISTS tax_annual_amount integer,
  ADD COLUMN IF NOT EXISTS tax_rate_area text,
  ADD COLUMN IF NOT EXISTS tax_assessments jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tax_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_sale_date text,
  ADD COLUMN IF NOT EXISTS last_sale_price integer,
  ADD COLUMN IF NOT EXISTS prior_sale_date text,
  ADD COLUMN IF NOT EXISTS prior_sale_price integer,
  ADD COLUMN IF NOT EXISTS estimated_value integer,
  ADD COLUMN IF NOT EXISTS estimated_rent integer,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_type text,
  ADD COLUMN IF NOT EXISTS owner_occupied boolean,
  ADD COLUMN IF NOT EXISTS owner_mailing_address text,
  ADD COLUMN IF NOT EXISTS owner_mailing_city text,
  ADD COLUMN IF NOT EXISTS owner_mailing_state text,
  ADD COLUMN IF NOT EXISTS owner_mailing_zip text,
  ADD COLUMN IF NOT EXISTS legal_description text,
  ADD COLUMN IF NOT EXISTS parcel_number text,
  ADD COLUMN IF NOT EXISTS apn text,
  ADD COLUMN IF NOT EXISTS subdivision text,
  ADD COLUMN IF NOT EXISTS zoning text,
  ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rentcast_data jsonb,
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_homes_rentcast_id ON homes(rentcast_id) WHERE rentcast_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_homes_zip_code ON homes(zip_code);

-- ============================================================
-- 2. HVAC systems table (richer than home_systems for HVAC)
-- ============================================================
CREATE TABLE IF NOT EXISTS hvac_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id uuid NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  system_type text NOT NULL DEFAULT 'central_ac'
    CHECK (system_type IN ('central_ac', 'heat_pump', 'furnace', 'mini_split', 'package_unit', 'dual_fuel', 'other')),
  location text CHECK (location IN ('indoor', 'outdoor', 'attic', 'garage', 'closet', 'basement', 'rooftop', 'other')),
  brand text,
  model text,
  serial text,
  tonnage numeric,
  seer numeric,
  afue numeric,
  hspf numeric,
  year_installed integer,
  estimated_age integer,
  fuel_type text,
  refrigerant_type text,
  condition text DEFAULT 'unknown'
    CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'failed', 'unknown')),
  warranty_status text DEFAULT 'unknown'
    CHECK (warranty_status IN ('active', 'expired', 'unknown')),
  warranty_expiry date,
  warranty_provider text,
  last_service_date date,
  next_service_due date,
  photo_url text,
  scan_data jsonb DEFAULT '{}'::jsonb,
  scan_confidence numeric,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hvac_systems_home_id ON hvac_systems(home_id);
ALTER TABLE hvac_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Homeowners can view own hvac_systems"
  ON hvac_systems FOR SELECT
  USING (home_id IN (SELECT id FROM homes WHERE owner_id = auth.uid()));

CREATE POLICY "Homeowners can manage own hvac_systems"
  ON hvac_systems FOR ALL
  USING (home_id IN (SELECT id FROM homes WHERE owner_id = auth.uid()));

-- ============================================================
-- 3. Equipment table (brand, model, serial, warranty, scanning)
-- ============================================================
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id uuid NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  equipment_type text NOT NULL
    CHECK (equipment_type IN ('ac_condenser', 'air_handler', 'furnace', 'heat_pump',
      'water_heater', 'tankless_water_heater', 'pool_pump', 'pool_heater',
      'generator', 'ev_charger', 'water_softener', 'air_purifier', 'thermostat',
      'electrical_panel', 'other')),
  brand text,
  model text,
  serial text,
  year_manufactured integer,
  year_installed integer,
  estimated_age integer,
  capacity text,
  efficiency_rating text,
  fuel_type text,
  location text,
  condition text DEFAULT 'unknown'
    CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'failed', 'unknown')),
  warranty_status text DEFAULT 'unknown'
    CHECK (warranty_status IN ('active', 'expired', 'unknown', 'transferable')),
  warranty_expiry date,
  warranty_provider text,
  warranty_type text,
  photo_url text,
  data_plate_photo_url text,
  scan_method text CHECK (scan_method IN ('photo', 'manual', 'api')),
  scan_data jsonb DEFAULT '{}'::jsonb,
  scan_confidence numeric,
  last_service_date date,
  next_service_due date,
  replacement_urgency text CHECK (replacement_urgency IN ('none', 'low', 'medium', 'high', 'critical')),
  estimated_replacement_cost integer,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_home_id ON equipment(home_id);
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Homeowners can view own equipment"
  ON equipment FOR SELECT
  USING (home_id IN (SELECT id FROM homes WHERE owner_id = auth.uid()));

CREATE POLICY "Homeowners can manage own equipment"
  ON equipment FOR ALL
  USING (home_id IN (SELECT id FROM homes WHERE owner_id = auth.uid()));

-- ============================================================
-- 4. Timeline events (maintenance history)
-- ============================================================
CREATE TABLE IF NOT EXISTS timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id uuid NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  equipment_id uuid REFERENCES equipment(id) ON DELETE SET NULL,
  hvac_system_id uuid REFERENCES hvac_systems(id) ON DELETE SET NULL,
  event_type text NOT NULL
    CHECK (event_type IN ('installation', 'repair', 'maintenance', 'inspection',
      'replacement', 'upgrade', 'emergency', 'warranty_claim', 'other')),
  title text NOT NULL,
  description text,
  provider_name text,
  cost integer,
  event_date date NOT NULL,
  documents jsonb DEFAULT '[]'::jsonb,
  photos jsonb DEFAULT '[]'::jsonb,
  source text DEFAULT 'manual'
    CHECK (source IN ('manual', 'order', 'import', 'servicetitan')),
  source_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_home_id ON timeline_events(home_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_equipment_id ON timeline_events(equipment_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_event_date ON timeline_events(event_date);
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Homeowners can view own timeline_events"
  ON timeline_events FOR SELECT
  USING (home_id IN (SELECT id FROM homes WHERE owner_id = auth.uid()));

CREATE POLICY "Homeowners can manage own timeline_events"
  ON timeline_events FOR ALL
  USING (home_id IN (SELECT id FROM homes WHERE owner_id = auth.uid()));

-- ============================================================
-- 5. Homeowner preferences (contact/notification settings)
-- ============================================================
CREATE TABLE IF NOT EXISTS homeowner_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE UNIQUE,
  contact_method text DEFAULT 'email'
    CHECK (contact_method IN ('email', 'sms', 'phone', 'any')),
  notification_email boolean DEFAULT true,
  notification_sms boolean DEFAULT false,
  notification_push boolean DEFAULT true,
  marketing_opt_in boolean DEFAULT false,
  preferred_schedule text DEFAULT 'weekday'
    CHECK (preferred_schedule IN ('weekday', 'weekend', 'evening', 'any')),
  preferred_language text DEFAULT 'en',
  timezone text DEFAULT 'America/Chicago',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE homeowner_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON homeowner_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own preferences"
  ON homeowner_preferences FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- 6. Stage templates (reusable order tracking milestones)
-- ============================================================
CREATE TABLE IF NOT EXISTS stage_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  service_category text,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stage_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES stage_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  estimated_duration_hours integer,
  is_customer_visible boolean DEFAULT true,
  notify_customer boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_template_items_template_id ON stage_template_items(template_id);
ALTER TABLE stage_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view stage_templates"
  ON stage_templates FOR SELECT USING (true);

CREATE POLICY "Anyone can view stage_template_items"
  ON stage_template_items FOR SELECT USING (true);

-- ============================================================
-- 7. Order stages (progress tracking on orders)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES order_items(id) ON DELETE CASCADE,
  template_item_id uuid REFERENCES stage_template_items(id),
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid REFERENCES user_profiles(id),
  notes text,
  customer_visible_note text,
  photos jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_stages_order_id ON order_stages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_stages_order_item_id ON order_stages(order_item_id);
ALTER TABLE order_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Homeowners can view own order_stages"
  ON order_stages FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));

CREATE POLICY "Contractors can view assigned order_stages"
  ON order_stages FOR SELECT
  USING (order_item_id IN (SELECT id FROM order_items WHERE contractor_id IN (
    SELECT id FROM contractors WHERE user_id = auth.uid()
  )));

CREATE POLICY "Contractors can update assigned order_stages"
  ON order_stages FOR UPDATE
  USING (order_item_id IN (SELECT id FROM order_items WHERE contractor_id IN (
    SELECT id FROM contractors WHERE user_id = auth.uid()
  )));

-- ============================================================
-- 8. Updated_at triggers for new tables
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hvac_systems_updated_at
  BEFORE UPDATE ON hvac_systems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_updated_at
  BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_timeline_events_updated_at
  BEFORE UPDATE ON timeline_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_homeowner_preferences_updated_at
  BEFORE UPDATE ON homeowner_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_stages_updated_at
  BEFORE UPDATE ON order_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
