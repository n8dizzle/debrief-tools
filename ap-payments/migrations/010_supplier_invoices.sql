-- AP Payments: supplier (vendor) invoices imported from CSV, starting with Shearer Supply.
-- Goal: bring in what we ACTUALLY paid a supplier for equipment/material, keyed by the
-- PO the ordering team enters (= the ServiceTitan sales estimate job #), so it can later
-- be validated against ServiceTitan's listed equipment pricing.
--
-- Two levels: one invoice header row + many line items. vendor column makes it
-- multi-supplier from day one (Shearer now, others later).

CREATE TABLE IF NOT EXISTS ap_supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor TEXT NOT NULL DEFAULT 'Shearer',
  doc_type TEXT,                       -- INVOICE / CREDIT / etc.
  invoice_number TEXT NOT NULL,        -- Shearer INVOICE_NUMBER (also ORDER_NUMBER here)
  order_number TEXT,
  po_number TEXT,                      -- raw PO as entered (estimate job # OR "WARRANTY"/"stock"/...)
  estimate_job_number TEXT,            -- po_number when it's a numeric ST job #, else null (the link key)
  account_number TEXT,
  salesperson TEXT,
  ship_to TEXT,
  order_date DATE,
  invoice_date DATE,
  due_date DATE,
  -- money (pre-tax merchandise is the figure we validate against ST equipment cost)
  merchandise NUMERIC(12,2),
  freight NUMERIC(12,2),
  service_charge NUMERIC(12,2),
  subtotal NUMERIC(12,2),
  sales_tax NUMERIC(12,2),
  total_due NUMERIC(12,2),
  uploaded_by UUID REFERENCES portal_users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (vendor, invoice_number)      -- re-uploads upsert, never duplicate
);

CREATE TABLE IF NOT EXISTS ap_supplier_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES ap_supplier_invoices(id) ON DELETE CASCADE,
  line_no INTEGER,
  sku TEXT,                            -- Shearer PRODUCT_COL (manufacturer SKU)
  description TEXT,
  uom TEXT,
  qty_ordered NUMERIC(12,2),
  qty_shipped NUMERIC(12,2),
  qty_backordered NUMERIC(12,2),
  unit_price NUMERIC(12,4),
  net_amount NUMERIC(12,2),
  is_return BOOLEAN DEFAULT false,     -- net_amount < 0
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ap_supplier_invoices_estjob ON ap_supplier_invoices(estimate_job_number);
CREATE INDEX IF NOT EXISTS idx_ap_supplier_invoices_vendor_date ON ap_supplier_invoices(vendor, invoice_date);
CREATE INDEX IF NOT EXISTS idx_ap_supplier_invoice_lines_invoice ON ap_supplier_invoice_lines(invoice_id);
