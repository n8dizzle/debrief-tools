-- 010_locations_blocked_reasons_tables.sql
-- Make the Location and Blocked dropdown option lists manager-editable from the
-- Settings tab (same DB-backed pattern as pe_suppliers / pe_install_teams).
--
-- Location = plain names (like suppliers). Blocked = value + label, because the
-- stored `pe_orders.blocked` slugs ('backordered', 'waiting_customer',
-- 'shipping_to_supplier') are referenced in code (the B/O checkbox writes
-- 'backordered'). Managers edit the LABEL; `value` is immutable once created.
--
-- Safe to apply BEFORE the code that reads these tables deploys — old code ignores them.

CREATE TABLE IF NOT EXISTS pe_locations (
  id         serial PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true
);

INSERT INTO pe_locations (name, sort_order) VALUES
  ('Lewisville Shop', 1),
  ('Supply House', 2)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS pe_blocked_reasons (
  id         serial PRIMARY KEY,
  value      text NOT NULL UNIQUE,
  label      text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true
);

INSERT INTO pe_blocked_reasons (value, label, sort_order) VALUES
  ('backordered',         'Backordered',          1),
  ('waiting_customer',    'Waiting on Customer',  2),
  ('shipping_to_supplier','Shipping to Supplier', 3)
ON CONFLICT (value) DO NOTHING;
