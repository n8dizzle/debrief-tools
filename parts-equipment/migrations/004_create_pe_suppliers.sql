-- Suppliers are now managed from Settings instead of the hardcoded SUPPLIERS
-- constant. Orders store the supplier by name (pe_orders.supplier TEXT), so
-- renaming/removing a supplier here never breaks existing order history.
CREATE TABLE IF NOT EXISTS pe_suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with the previously hardcoded list, preserving order.
INSERT INTO pe_suppliers (name, sort_order) VALUES
  ('Johnstone', 1),
  ('Winsupply', 2),
  ('Ferguson', 3),
  ('Daikin', 4),
  ('Carrier', 5),
  ('Trane', 6),
  ('Lennox', 7),
  ('Rheem', 8),
  ('Goodman', 9),
  ('York', 10),
  ('Amana', 11),
  ('Bryant', 12),
  ('Heil', 13),
  ('ADP', 14),
  ('Mitsubishi', 15),
  ('Fujitsu', 16),
  ('LG', 17),
  ('Bosch', 18),
  ('American Standard', 19),
  ('Ruud', 20),
  ('Nordyne', 21),
  ('ICP', 22),
  ('Allied', 23),
  ('Grandaire', 24),
  ('Concord', 25),
  ('Tempstar', 26),
  ('Keeprite', 27),
  ('Comfortmaker', 28),
  ('Arcoaire', 29),
  ('Day & Night', 30),
  ('National Comfort Products', 31),
  ('Emerson', 32),
  ('White-Rodgers', 33),
  ('Honeywell', 34),
  ('Ecobee', 35),
  ('Nest', 36),
  ('iComfort', 37),
  ('Infinity', 38),
  ('Navien', 39),
  ('Rinnai', 40),
  ('Noritz', 41),
  ('Bradford White', 42),
  ('A.O. Smith', 43),
  ('State Water Heaters', 44),
  ('Other', 45)
ON CONFLICT (name) DO NOTHING;
