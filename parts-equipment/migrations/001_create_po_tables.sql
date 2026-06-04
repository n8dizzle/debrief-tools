-- Parts & Equipment Order Workflow
-- Table prefix: po_

CREATE TABLE po_orders (
  -- Identity
  job_id            VARCHAR(20) PRIMARY KEY,
  st_url            TEXT,

  -- From ServiceTitan
  customer_name     VARCHAR(255),
  technician        VARCHAR(100),
  job_type          VARCHAR(50),
  date_added        DATE,

  -- Dashboard-managed
  owner             VARCHAR(50),
  location          VARCHAR(50),
  supplier          VARCHAR(100),
  order_number      VARCHAR(100),
  part_description  TEXT,
  part_cost         VARCHAR(20),
  is_equipment      BOOLEAN DEFAULT false,
  warranty          VARCHAR(10) DEFAULT 'No',
  eta_date          DATE,
  scheduled_date    DATE,

  -- Notes
  notes_warehouse   TEXT,
  notes_cxr         TEXT,

  -- Backorder flow
  bo_notified       BOOLEAN DEFAULT false,
  bo_notified_date  DATE,

  -- Cancel flow
  cancel_source     VARCHAR(255),
  cancel_reason     TEXT,

  -- Completion
  status            VARCHAR(20) DEFAULT 'open',  -- open, completed, cancelled
  completed_by      VARCHAR(100),
  completed_at      TIMESTAMPTZ,

  -- Audit
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE po_audit_log (
  id            SERIAL PRIMARY KEY,
  job_id        VARCHAR(20),
  event_type    VARCHAR(50),   -- created, edit, completed, cancelled, sync
  action        TEXT,
  detail        TEXT,
  performed_by  VARCHAR(100),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_po_orders_status ON po_orders(status);
CREATE INDEX idx_po_orders_date_added ON po_orders(date_added DESC);
CREATE INDEX idx_po_orders_owner ON po_orders(owner);
CREATE INDEX idx_po_orders_location ON po_orders(location);
CREATE INDEX idx_po_audit_log_job_id ON po_audit_log(job_id);
CREATE INDEX idx_po_audit_log_created_at ON po_audit_log(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION po_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER po_orders_updated_at
  BEFORE UPDATE ON po_orders
  FOR EACH ROW EXECUTE FUNCTION po_update_updated_at();
