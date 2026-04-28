-- Migration 003: ST Inventory Transfers cache
-- Line items are embedded in the list response (no separate items endpoint)

CREATE TABLE IF NOT EXISTS st_inventory_transfers (
  id               BIGINT      PRIMARY KEY,          -- ST transfer id
  transfer_type    TEXT,                              -- 'Standard', 'Return', etc.
  status           TEXT,                              -- 'Received', 'Pending', 'Canceled', etc.
  number           TEXT,                              -- ST human-readable number (e.g. "7")
  reference_number TEXT,
  from_location_id BIGINT,
  to_location_id   BIGINT,
  created_by_id    BIGINT,
  picked_by_id     BIGINT,
  received_by_id   BIGINT,
  memo             TEXT,
  job_id           BIGINT,
  invoice_id       BIGINT,
  batch_id         BIGINT,
  active           BOOLEAN     NOT NULL DEFAULT TRUE,
  transfer_date    TIMESTAMPTZ,
  picked_date      TIMESTAMPTZ,
  received_date    TIMESTAMPTZ,
  date_required    TIMESTAMPTZ,
  date_canceled    TIMESTAMPTZ,
  st_created_on    TIMESTAMPTZ,
  st_modified_on   TIMESTAMPTZ,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS st_inventory_transfer_items (
  id               BIGINT      PRIMARY KEY,          -- ST item id
  transfer_id      BIGINT      NOT NULL REFERENCES st_inventory_transfers(id) ON DELETE CASCADE,
  sku_id           BIGINT,                           -- maps to materials.st_pricebook_id (cast to text)
  name             TEXT,
  code             TEXT,                             -- SKU code
  description      TEXT,
  quantity         NUMERIC,
  quantity_picked  NUMERIC,
  cost             NUMERIC,                          -- unit cost
  total_cost       NUMERIC,
  active           BOOLEAN     NOT NULL DEFAULT TRUE,
  st_created_on    TIMESTAMPTZ,
  st_modified_on   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_st_xfer_items_transfer  ON st_inventory_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_st_xfer_items_sku       ON st_inventory_transfer_items(sku_id);
CREATE INDEX IF NOT EXISTS idx_st_xfers_status         ON st_inventory_transfers(status);
CREATE INDEX IF NOT EXISTS idx_st_xfers_date           ON st_inventory_transfers(transfer_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_st_xfers_modified       ON st_inventory_transfers(st_modified_on DESC NULLS LAST);
