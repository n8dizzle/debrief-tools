-- Drop old tables if they exist (legacy po_ prefix)
DROP TABLE IF EXISTS po_audit_log;
DROP TABLE IF EXISTS po_orders;

-- Parts & Equipment Orders
CREATE TABLE IF NOT EXISTS pe_orders (
  id BIGSERIAL PRIMARY KEY,
  date DATE,
  job TEXT NOT NULL DEFAULT '',
  tech TEXT NOT NULL DEFAULT '',
  customer TEXT NOT NULL DEFAULT '',
  order_type TEXT NOT NULL DEFAULT 'service' CHECK (order_type IN ('service', 'install')),
  subtype TEXT NOT NULL DEFAULT '',
  warranty TEXT NOT NULL DEFAULT 'No',
  warranty_type TEXT NOT NULL DEFAULT '',
  part TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  order_num TEXT NOT NULL DEFAULT '',
  cost TEXT NOT NULL DEFAULT '',
  estimate_cost TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT 'Place Order',
  owner TEXT NOT NULL DEFAULT 'Unassigned',
  eta DATE,
  scheduled_date DATE,
  note_wh TEXT NOT NULL DEFAULT '',
  note_cxr TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
  is_equipment BOOLEAN NOT NULL DEFAULT false,
  cancel_source TEXT NOT NULL DEFAULT '',
  cancel_reason TEXT NOT NULL DEFAULT '',
  bo_notified BOOLEAN NOT NULL DEFAULT false,
  bo_notified_date DATE,
  completed_by TEXT NOT NULL DEFAULT '',
  completed_at TIMESTAMPTZ,
  linked_jobs TEXT[] NOT NULL DEFAULT '{}',
  st_url TEXT NOT NULL DEFAULT '',
  install_team TEXT NOT NULL DEFAULT '',
  sub_rate TEXT NOT NULL DEFAULT '',
  equip_cost TEXT NOT NULL DEFAULT '',
  sched_date DATE,
  call_booked BOOLEAN NOT NULL DEFAULT false,
  job_cost TEXT NOT NULL DEFAULT '',
  equip_avail TEXT NOT NULL DEFAULT '',
  bo_ordered BOOLEAN NOT NULL DEFAULT false,
  bo_status TEXT NOT NULL DEFAULT '',
  parts_ordered BOOLEAN NOT NULL DEFAULT false,
  part_bo BOOLEAN NOT NULL DEFAULT false,
  bo_informed BOOLEAN NOT NULL DEFAULT false,
  parts_at_shop BOOLEAN NOT NULL DEFAULT false,
  two_techs BOOLEAN NOT NULL DEFAULT false,
  qc_scheduled BOOLEAN NOT NULL DEFAULT false,
  qc_date DATE,
  tracking TEXT NOT NULL DEFAULT '',
  tech_type TEXT NOT NULL DEFAULT '',
  needs_order BOOLEAN NOT NULL DEFAULT false,
  multiple_estimates BOOLEAN NOT NULL DEFAULT false,
  estimates JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS pe_orders_status_idx ON pe_orders(status);
CREATE INDEX IF NOT EXISTS pe_orders_order_type_idx ON pe_orders(order_type);
CREATE INDEX IF NOT EXISTS pe_orders_owner_idx ON pe_orders(owner);
CREATE INDEX IF NOT EXISTS pe_orders_date_idx ON pe_orders(date);
CREATE INDEX IF NOT EXISTS pe_orders_created_at_idx ON pe_orders(created_at);

-- Warranty Claims
CREATE TABLE IF NOT EXISTS pe_warranty_claims (
  id BIGSERIAL PRIMARY KEY,
  last_name TEXT NOT NULL DEFAULT '',
  mfgr TEXT NOT NULL DEFAULT '',
  fail_date DATE,
  repair_date DATE,
  main_model_num TEXT NOT NULL DEFAULT '',
  main_unit_sn TEXT NOT NULL DEFAULT '',
  failed_part_num TEXT NOT NULL DEFAULT '',
  failed_part_serial TEXT NOT NULL DEFAULT '',
  mfg_invoice_num TEXT NOT NULL DEFAULT '',
  repl_part_num TEXT NOT NULL DEFAULT '',
  repl_part_serial TEXT NOT NULL DEFAULT '',
  date_of_claim DATE,
  claim_num TEXT NOT NULL DEFAULT '',
  credit_approved TEXT NOT NULL DEFAULT '',
  return_required TEXT NOT NULL DEFAULT '',
  amt_charged TEXT NOT NULL DEFAULT '',
  amt_refunded TEXT NOT NULL DEFAULT '',
  paid TEXT NOT NULL DEFAULT '',
  job TEXT NOT NULL DEFAULT '',
  tech TEXT NOT NULL DEFAULT '',
  customer TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pe_warranty_status_idx ON pe_warranty_claims(status);
CREATE INDEX IF NOT EXISTS pe_warranty_paid_idx ON pe_warranty_claims(paid);

-- Audit Log
CREATE TABLE IF NOT EXISTS pe_audit_log (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'edit',
  job_id TEXT NOT NULL DEFAULT '',
  customer TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pe_audit_created_at_idx ON pe_audit_log(created_at);
CREATE INDEX IF NOT EXISTS pe_audit_type_idx ON pe_audit_log(type);

-- Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION pe_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pe_orders_updated_at ON pe_orders;
CREATE TRIGGER pe_orders_updated_at
  BEFORE UPDATE ON pe_orders
  FOR EACH ROW EXECUTE FUNCTION pe_set_updated_at();

DROP TRIGGER IF EXISTS pe_warranty_updated_at ON pe_warranty_claims;
CREATE TRIGGER pe_warranty_updated_at
  BEFORE UPDATE ON pe_warranty_claims
  FOR EACH ROW EXECUTE FUNCTION pe_set_updated_at();
