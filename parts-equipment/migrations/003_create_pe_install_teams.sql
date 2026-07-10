-- Install teams are now managed from Settings instead of the hardcoded
-- INSTALL_TEAMS constant. Existing orders store the team by name (pe_orders.
-- install_team TEXT), so renaming/removing a team here never breaks history.
CREATE TABLE IF NOT EXISTS pe_install_teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with the previously hardcoded list, preserving order.
INSERT INTO pe_install_teams (name, sort_order) VALUES
  ('Team A', 1),
  ('Team B', 2),
  ('Team C', 3),
  ('Team D', 4),
  ('Team E', 5),
  ('Sub', 6)
ON CONFLICT (name) DO NOTHING;
