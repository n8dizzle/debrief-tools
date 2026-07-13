-- Marketing monthly targets for pacing scorecard
-- Seeded from Google Sheet Targets tab; synced nightly via /api/targets/sync
-- KPI keys: revenue, leads, hvac_replacement_leads, new_customer_revenue, spend_budget, reviews

CREATE TABLE IF NOT EXISTS marketing_monthly_targets (
  id          serial primary key,
  year        int not null,
  month       int not null,  -- 1–12
  kpi         text not null, -- see KPI keys above
  target      numeric not null,
  updated_at  timestamptz default now(),
  unique (year, month, kpi)
);

CREATE INDEX IF NOT EXISTS idx_mmt_year_month ON marketing_monthly_targets(year, month);
CREATE INDEX IF NOT EXISTS idx_mmt_kpi ON marketing_monthly_targets(kpi);

ALTER TABLE marketing_monthly_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage marketing_monthly_targets"
  ON marketing_monthly_targets FOR ALL
  USING (true)
  WITH CHECK (true);

-- Jul 2026 targets confirmed from Google Sheet Targets tab (2026-07-01)
INSERT INTO marketing_monthly_targets (year, month, kpi, target) VALUES
  (2026, 7, 'revenue',                 2000051),
  (2026, 7, 'leads',                   1594),
  (2026, 7, 'hvac_replacement_leads',  133),
  (2026, 7, 'new_customer_revenue',    600015),
  (2026, 7, 'spend_budget',            63152),
  (2026, 7, 'reviews',                 159)
ON CONFLICT (year, month, kpi) DO UPDATE
  SET target     = EXCLUDED.target,
      updated_at = NOW();
