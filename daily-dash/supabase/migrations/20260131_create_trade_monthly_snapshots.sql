-- Create trade_monthly_snapshots table for caching 18-month trend data
-- This eliminates slow ServiceTitan API calls on every page load

CREATE TABLE IF NOT EXISTS trade_monthly_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month text NOT NULL,           -- "2025-01" format
  trade text NOT NULL,                 -- 'hvac' or 'plumbing'
  revenue numeric DEFAULT 0,
  completed_revenue numeric DEFAULT 0,
  non_job_revenue numeric DEFAULT 0,
  adj_revenue numeric DEFAULT 0,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(year_month, trade)
);

CREATE INDEX IF NOT EXISTS idx_monthly_snapshots_year_month ON trade_monthly_snapshots(year_month);

-- Add comment for documentation
COMMENT ON TABLE trade_monthly_snapshots IS 'Cached monthly revenue totals for 18-month trend chart. Synced nightly from ServiceTitan via /api/trades/sync-monthly cron job.';

-- Enable RLS (Row Level Security)
ALTER TABLE trade_monthly_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read" ON trade_monthly_snapshots
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to insert/update (for API routes)
CREATE POLICY "Allow service role write" ON trade_monthly_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
