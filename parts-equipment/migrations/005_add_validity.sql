-- "Validity" column on the Service board — a Settings-managed dropdown (like
-- pe_install_teams / pe_suppliers). The selected value is stored on the order
-- by name (pe_orders.validity TEXT); the pickable options live in pe_validities.
ALTER TABLE pe_orders ADD COLUMN IF NOT EXISTS validity TEXT;

CREATE TABLE IF NOT EXISTS pe_validities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Options intentionally seeded empty; managers add them under Settings → Validity.
