-- ============================================================
-- Inventory Management System — Full Schema
-- Migration 001 — Initial schema
-- ============================================================
-- Run via: node scripts/migrate.js
-- Idempotent: uses IF NOT EXISTS / CREATE OR REPLACE throughout
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────────────────────────────────────
-- HELPER: updated_at trigger
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. WAREHOUSES
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  department        TEXT        NOT NULL CHECK (department IN ('plumbing','hvac','all')),
  address           TEXT,
  city              TEXT,
  state             TEXT,
  zip               TEXT,
  geo_lat           NUMERIC(10,7),
  geo_lng           NUMERIC(10,7),
  geo_radius_miles  NUMERIC(5,2) DEFAULT 0.25,
  status            TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS warehouses_updated_at ON warehouses;
CREATE TRIGGER warehouses_updated_at BEFORE UPDATE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. WAREHOUSE LOCATIONS  (bins/shelves within a warehouse)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id  UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  aisle         TEXT,
  bay           TEXT,
  bin           TEXT,
  label         TEXT NOT NULL,          -- e.g. "A1-B2-C3"
  barcode       TEXT UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wl_warehouse ON warehouse_locations(warehouse_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. TRUCKS
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trucks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_number       TEXT NOT NULL UNIQUE,
  department         TEXT NOT NULL CHECK (department IN ('plumbing','hvac')),
  home_warehouse_id  UUID NOT NULL REFERENCES warehouses(id),
  st_vehicle_id      TEXT,               -- ServiceTitan vehicle ID
  make               TEXT,
  model              TEXT,
  year               SMALLINT,
  license_plate      TEXT,
  vin                TEXT,
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','retired')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trucks_updated_at ON trucks;
CREATE TRIGGER trucks_updated_at BEFORE UPDATE ON trucks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. USERS
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  password_hash       TEXT,
  role                TEXT NOT NULL DEFAULT 'tech'
                        CHECK (role IN ('admin','manager','tech','viewer')),
  department          TEXT NOT NULL DEFAULT 'all',
  phone               TEXT,
  home_warehouse_id   UUID REFERENCES warehouses(id),
  assigned_truck_id   UUID REFERENCES trucks(id),
  st_technician_id    TEXT,             -- ServiceTitan tech ID
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_truck ON users(assigned_truck_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. SUPPLY HOUSES  (vendors)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supply_houses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  account_number    TEXT,
  contact_name      TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,
  department        TEXT NOT NULL DEFAULT 'all',
  lead_time_days    SMALLINT NOT NULL DEFAULT 1,
  preferred_po_day  TEXT,               -- e.g. 'monday'
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS supply_houses_updated_at ON supply_houses;
CREATE TRIGGER supply_houses_updated_at BEFORE UPDATE ON supply_houses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. MATERIALS
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS materials (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT NOT NULL,
  description               TEXT,
  sku                       TEXT UNIQUE,
  barcode                   TEXT UNIQUE,
  unit_of_measure           TEXT NOT NULL DEFAULT 'EA',
  department                TEXT NOT NULL CHECK (department IN ('plumbing','hvac','all')),
  category                  TEXT,
  st_pricebook_id           TEXT,       -- ServiceTitan pricebook item ID
  unit_cost                 NUMERIC(10,2),
  reorder_point             INTEGER NOT NULL DEFAULT 0,
  reorder_quantity          INTEGER NOT NULL DEFAULT 0,
  max_stock                 INTEGER,
  primary_supply_house_id   UUID REFERENCES supply_houses(id),
  secondary_supply_house_id UUID REFERENCES supply_houses(id),
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS materials_updated_at ON materials;
CREATE TRIGGER materials_updated_at BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_materials_sku      ON materials(sku);
CREATE INDEX IF NOT EXISTS idx_materials_dept     ON materials(department);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. WAREHOUSE STOCK
-- Unique per (material, warehouse, optional shelf location).
-- location_id = NULL means the material is tracked at warehouse level only.
-- NULLS NOT DISTINCT ensures only one "no-location" row per material+warehouse.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse_stock (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id       UUID        NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  warehouse_id      UUID        NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  location_id       UUID        REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  quantity_on_hand  INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  quantity_reserved INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  last_counted_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (material_id, warehouse_id, location_id)
);
DROP TRIGGER IF EXISTS warehouse_stock_updated_at ON warehouse_stock;
CREATE TRIGGER warehouse_stock_updated_at BEFORE UPDATE ON warehouse_stock
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_ws_material   ON warehouse_stock(material_id);
CREATE INDEX IF NOT EXISTS idx_ws_warehouse  ON warehouse_stock(warehouse_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. TRUCK STOCK
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS truck_stock (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id       UUID        NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  truck_id          UUID        NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  quantity_on_hand  INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  last_counted_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (material_id, truck_id)
);
DROP TRIGGER IF EXISTS truck_stock_updated_at ON truck_stock;
CREATE TRIGGER truck_stock_updated_at BEFORE UPDATE ON truck_stock
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_ts_material ON truck_stock(material_id);
CREATE INDEX IF NOT EXISTS idx_ts_truck    ON truck_stock(truck_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 9. RESTOCK BATCHES
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restock_batches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number   TEXT NOT NULL UNIQUE
                   DEFAULT ('RST-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM()*99999)::TEXT, 5, '0')),
  truck_id       UUID NOT NULL REFERENCES trucks(id),
  warehouse_id   UUID NOT NULL REFERENCES warehouses(id),
  status         TEXT NOT NULL DEFAULT 'collecting'
                   CHECK (status IN ('collecting','locked','approved','picked','completed','partially_completed')),
  lock_trigger   TEXT DEFAULT 'manual' CHECK (lock_trigger IN ('manual','scheduled')),
  locked_at      TIMESTAMPTZ,
  locked_by      UUID REFERENCES users(id),
  approved_at    TIMESTAMPTZ,
  approved_by    UUID REFERENCES users(id),
  picked_at      TIMESTAMPTZ,
  picked_by      UUID REFERENCES users(id),
  completed_at   TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS restock_batches_updated_at ON restock_batches;
CREATE TRIGGER restock_batches_updated_at BEFORE UPDATE ON restock_batches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_rb_truck  ON restock_batches(truck_id);
CREATE INDEX IF NOT EXISTS idx_rb_status ON restock_batches(status);

-- ──────────────────────────────────────────────────────────────────────────────
-- 10. RESTOCK LINES
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restock_lines (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id            UUID    NOT NULL REFERENCES restock_batches(id) ON DELETE CASCADE,
  material_id         UUID    NOT NULL REFERENCES materials(id),
  quantity_requested  INTEGER NOT NULL CHECK (quantity_requested > 0),
  quantity_approved   INTEGER CHECK (quantity_approved >= 0),
  status              TEXT    NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','denied')),
  denial_reason       TEXT,
  is_short            BOOLEAN NOT NULL DEFAULT FALSE,
  st_job_id           TEXT,
  st_work_order_id    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS restock_lines_updated_at ON restock_lines;
CREATE TRIGGER restock_lines_updated_at BEFORE UPDATE ON restock_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_rl_batch    ON restock_lines(batch_id);
CREATE INDEX IF NOT EXISTS idx_rl_material ON restock_lines(material_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 11. TECH BINS  (labeled bins loaded at warehouse, scanned at truck)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tech_bins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode         TEXT NOT NULL UNIQUE,
  bin_label       TEXT NOT NULL,
  technician_id   UUID REFERENCES users(id),
  warehouse_id    UUID REFERENCES warehouses(id),
  status          TEXT NOT NULL DEFAULT 'empty'
                    CHECK (status IN ('empty','loading','ready_to_scan','scanned')),
  scanned_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS tech_bins_updated_at ON tech_bins;
CREATE TRIGGER tech_bins_updated_at BEFORE UPDATE ON tech_bins
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- 12. BIN ITEMS  (contents of a tech bin)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bin_items (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  bin_id           UUID    NOT NULL REFERENCES tech_bins(id) ON DELETE CASCADE,
  material_id      UUID    NOT NULL REFERENCES materials(id),
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  restock_line_id  UUID    REFERENCES restock_lines(id),
  scanned_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bi_bin ON bin_items(bin_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 13. PURCHASE ORDERS
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number        TEXT NOT NULL UNIQUE,
  supply_house_id  UUID REFERENCES supply_houses(id),
  warehouse_id     UUID NOT NULL REFERENCES warehouses(id),
  department       TEXT NOT NULL,
  trigger_type     TEXT NOT NULL DEFAULT 'manual'
                     CHECK (trigger_type IN ('manual','scheduled_weekly','restock_batch')),
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','pending_review','sent','partially_received','received','cancelled')),
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  review_deadline  TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  received_at      TIMESTAMPTZ,
  received_by      UUID REFERENCES users(id),
  reviewed_by      UUID REFERENCES users(id),
  created_by       UUID REFERENCES users(id),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_po_status     ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_warehouse  ON purchase_orders(warehouse_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 14. PO LINES
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS po_lines (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id                 UUID        NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  material_id           UUID        NOT NULL REFERENCES materials(id),
  quantity_ordered      INTEGER     NOT NULL CHECK (quantity_ordered > 0),
  quantity_received     INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost             NUMERIC(10,2),
  line_total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  backorder_routed_to   UUID        REFERENCES supply_houses(id),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS po_lines_updated_at ON po_lines;
CREATE TRIGGER po_lines_updated_at BEFORE UPDATE ON po_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_pol_po       ON po_lines(po_id);
CREATE INDEX IF NOT EXISTS idx_pol_material ON po_lines(material_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 15. MATERIAL MOVEMENTS  (immutable audit log)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS material_movements (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id       UUID    NOT NULL REFERENCES materials(id),
  movement_type     TEXT    NOT NULL
                      CHECK (movement_type IN (
                        'received','transferred','loaded_to_bin','bin_to_truck',
                        'consumed_on_job','returned_to_stock','adjustment','cycle_count'
                      )),
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  performed_by      UUID    REFERENCES users(id),
  from_warehouse_id UUID    REFERENCES warehouses(id),
  from_truck_id     UUID    REFERENCES trucks(id),
  from_bin_id       UUID    REFERENCES tech_bins(id),
  to_warehouse_id   UUID    REFERENCES warehouses(id),
  to_truck_id       UUID    REFERENCES trucks(id),
  to_bin_id         UUID    REFERENCES tech_bins(id),
  st_job_id         TEXT,
  st_work_order_id  TEXT,
  notes             TEXT,
  restock_batch_id  UUID    REFERENCES restock_batches(id),
  restock_line_id   UUID    REFERENCES restock_lines(id),
  po_id             UUID    REFERENCES purchase_orders(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mm_material  ON material_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_mm_type      ON material_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_mm_created   ON material_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mm_truck     ON material_movements(from_truck_id);
CREATE INDEX IF NOT EXISTS idx_mm_job       ON material_movements(st_job_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 16. TOOLS
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tools (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  manufacturer        TEXT,
  model               TEXT,
  serial_number       TEXT UNIQUE,
  barcode             TEXT UNIQUE,
  department          TEXT NOT NULL CHECK (department IN ('plumbing','hvac','all')),
  home_warehouse_id   UUID REFERENCES warehouses(id),
  category            TEXT,             -- 'power_tool','hand_tool','specialty','test_equipment'
  current_condition   TEXT NOT NULL DEFAULT 'good'
                        CHECK (current_condition IN ('excellent','good','fair','poor')),
  status              TEXT NOT NULL DEFAULT 'available'
                        CHECK (status IN ('available','checked_out','out_for_service','retired')),
  checked_out_to      UUID REFERENCES users(id),
  checked_out_truck   UUID REFERENCES trucks(id),
  expected_return_date DATE,
  st_equipment_id     TEXT,
  purchase_date       DATE,
  purchase_cost       NUMERIC(10,2),
  warranty_expiry     DATE,
  service_notes       TEXT,
  notes               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS tools_updated_at ON tools;
CREATE TRIGGER tools_updated_at BEFORE UPDATE ON tools
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_tools_dept   ON tools(department);
CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(status);

-- ──────────────────────────────────────────────────────────────────────────────
-- 17. TOOL MOVEMENTS  (checkout / checkin / service audit log)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tool_movements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id           UUID NOT NULL REFERENCES tools(id),
  movement_type     TEXT NOT NULL
                      CHECK (movement_type IN ('checkout','checkin','service_out','service_return','retired')),
  performed_by      UUID REFERENCES users(id),
  technician_id     UUID REFERENCES users(id),
  truck_id          UUID REFERENCES trucks(id),
  st_job_id         TEXT,
  condition_at_time TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tm_tool    ON tool_movements(tool_id);
CREATE INDEX IF NOT EXISTS idx_tm_created ON tool_movements(created_at DESC);

-- ──────────────────────────────────────────────────────────────────────────────
-- 18. EQUIPMENT  (installed customer/building equipment tracked for service)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  manufacturer        TEXT,
  model               TEXT,
  serial_number       TEXT,
  category            TEXT,
  department          TEXT NOT NULL CHECK (department IN ('plumbing','hvac','all')),
  warehouse_id        UUID REFERENCES warehouses(id),
  location_id         UUID REFERENCES warehouse_locations(id),
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','needs_service','retired')),
  condition           TEXT NOT NULL DEFAULT 'good'
                        CHECK (condition IN ('excellent','good','fair','poor')),
  st_equipment_id     TEXT UNIQUE,
  installation_date   DATE,
  warranty_expiry     DATE,
  last_service_date   DATE,
  next_service_due    DATE,
  purchase_cost       NUMERIC(10,2),
  notes               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS equipment_updated_at ON equipment;
CREATE TRIGGER equipment_updated_at BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_equip_dept ON equipment(department);

-- ──────────────────────────────────────────────────────────────────────────────
-- 19. IT ASSETS
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS it_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type      TEXT NOT NULL,        -- 'phone','tablet','laptop','desktop','other'
  manufacturer    TEXT,
  model           TEXT,
  serial_number   TEXT UNIQUE,
  imei            TEXT,
  udid            TEXT,
  asset_tag       TEXT UNIQUE,
  department      TEXT NOT NULL DEFAULT 'all',
  purchase_date   DATE,
  purchase_cost   NUMERIC(10,2),
  vendor          TEXT,
  warranty_expiry DATE,
  mdm_enrolled    BOOLEAN NOT NULL DEFAULT FALSE,
  carrier         TEXT,
  phone_number    TEXT,
  status          TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available','assigned','in_repair','retired')),
  assigned_to     UUID REFERENCES users(id),
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS it_assets_updated_at ON it_assets;
CREATE TRIGGER it_assets_updated_at BEFORE UPDATE ON it_assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- 20. IT ASSET ASSIGNMENTS  (history of who had which device)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS it_asset_assignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id       UUID NOT NULL REFERENCES it_assets(id) ON DELETE CASCADE,
  assigned_to    UUID NOT NULL REFERENCES users(id),
  assigned_by    UUID REFERENCES users(id),
  unassigned_at  TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_itaa_asset ON it_asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_itaa_user  ON it_asset_assignments(assigned_to);

-- ──────────────────────────────────────────────────────────────────────────────
-- MIGRATION TRACKING  (so we never run the same file twice)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT        PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 21. APP SETTINGS  (key/value config store, section-scoped)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  section     TEXT        NOT NULL,
  key         TEXT        NOT NULL,
  value       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (section, key)
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 22. ST JOBS  (ServiceTitan job cache for the scanner job-picker)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS st_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_job_id        TEXT UNIQUE,           -- ServiceTitan job ID
  job_number       TEXT NOT NULL,
  customer_name    TEXT,
  customer_address TEXT,
  status           TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','in_progress','completed','cancelled','on_hold')),
  job_type         TEXT,
  truck_id         UUID REFERENCES trucks(id),
  technician_id    UUID REFERENCES users(id),
  scheduled_at     TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_st_jobs_truck  ON st_jobs(truck_id);
CREATE INDEX IF NOT EXISTS idx_st_jobs_status ON st_jobs(status);
DROP TRIGGER IF EXISTS st_jobs_updated_at ON st_jobs;
CREATE TRIGGER st_jobs_updated_at BEFORE UPDATE ON st_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
