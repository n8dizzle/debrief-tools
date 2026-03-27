-- =============================================
-- Migration 00003: Master Catalog
-- =============================================
-- 3 departments, 16 categories, 100 services
-- with variables, addons, and HomeFit rules

-- Departments (The Lot, The Exterior, The Interior)
CREATE TABLE catalog_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT, -- icon name or emoji
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories (16 mid-level groupings)
CREATE TABLE catalog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES catalog_departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_catalog_categories_dept ON catalog_categories(department_id);

-- Services (100 bookable services)
CREATE TABLE catalog_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES catalog_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT, -- one-liner for cards
  description TEXT, -- full scope definition
  scope_includes TEXT[], -- bullet points of what's included
  scope_excludes TEXT[], -- bullet points of what's NOT included

  -- Productizability
  productizability INTEGER NOT NULL DEFAULT 3 CHECK (productizability BETWEEN 1 AND 5),
  pricing_type TEXT NOT NULL DEFAULT 'configurator'
    CHECK (pricing_type IN ('instant_price', 'configurator', 'photo_estimate', 'onsite_estimate', 'custom')),

  -- Launch wave (1-4)
  launch_wave INTEGER NOT NULL DEFAULT 1 CHECK (launch_wave BETWEEN 1 AND 4),

  -- HomeFit rules (JSONB) - conditions for when this service is relevant
  -- e.g., {"has_pool": true} or {"hvac_type": "central"} or {"sqft_min": 1000}
  homefit_rules JSONB DEFAULT '{}',

  -- Estimated duration in minutes
  estimated_duration_min INTEGER,
  estimated_duration_max INTEGER,

  -- Display
  icon TEXT,
  image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,

  -- Full-text search
  search_vector TSVECTOR,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_catalog_services_category ON catalog_services(category_id);
CREATE INDEX idx_catalog_services_wave ON catalog_services(launch_wave);
CREATE INDEX idx_catalog_services_pricing ON catalog_services(pricing_type);
CREATE INDEX idx_catalog_services_search ON catalog_services USING gin(search_vector);
CREATE INDEX idx_catalog_services_active ON catalog_services(is_active) WHERE is_active = TRUE;

-- Auto-update search vector
CREATE OR REPLACE FUNCTION update_service_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.short_description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_catalog_services_search
  BEFORE INSERT OR UPDATE OF name, short_description, description
  ON catalog_services
  FOR EACH ROW
  EXECUTE FUNCTION update_service_search_vector();

-- Service Variables (dynamic configurator options)
-- e.g., for "AC Replacement": tonnage (2-5), SEER rating (14-20), brand
CREATE TABLE catalog_service_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES catalog_services(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- internal name
  label TEXT NOT NULL, -- display label
  description TEXT,
  variable_type TEXT NOT NULL CHECK (variable_type IN ('select', 'number', 'boolean', 'text')),
  options JSONB, -- for select: [{value, label, price_modifier}], for number: {min, max, step}
  is_required BOOLEAN DEFAULT TRUE,
  affects_pricing BOOLEAN DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_catalog_variables_service ON catalog_service_variables(service_id);

-- Service Addons (optional extras)
-- e.g., for "AC Tune-Up": UV light add-on, duct cleaning add-on
CREATE TABLE catalog_service_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES catalog_services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  suggested_price INTEGER, -- cents - suggested retail price
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_catalog_addons_service ON catalog_service_addons(service_id);

-- Updated_at triggers
CREATE TRIGGER update_catalog_departments_updated_at
  BEFORE UPDATE ON catalog_departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_catalog_categories_updated_at
  BEFORE UPDATE ON catalog_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_catalog_services_updated_at
  BEFORE UPDATE ON catalog_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE catalog_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_service_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_service_addons ENABLE ROW LEVEL SECURITY;

-- Catalog is public read
CREATE POLICY "Catalog departments public read" ON catalog_departments FOR SELECT USING (true);
CREATE POLICY "Catalog categories public read" ON catalog_categories FOR SELECT USING (true);
CREATE POLICY "Catalog services public read" ON catalog_services FOR SELECT USING (true);
CREATE POLICY "Catalog variables public read" ON catalog_service_variables FOR SELECT USING (true);
CREATE POLICY "Catalog addons public read" ON catalog_service_addons FOR SELECT USING (true);

-- Only admins can modify catalog
CREATE POLICY "Admins manage departments" ON catalog_departments FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage categories" ON catalog_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage services" ON catalog_services FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage variables" ON catalog_service_variables FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins manage addons" ON catalog_service_addons FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
