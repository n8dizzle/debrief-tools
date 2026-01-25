-- GBP Insights Cache Table
-- Run this migration in Supabase SQL Editor
-- Caches Google Business Profile performance metrics

-- Create gbp_insights_cache table
CREATE TABLE IF NOT EXISTS gbp_insights_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES google_locations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  -- Impressions/Views
  views_maps INTEGER DEFAULT 0,
  views_search INTEGER DEFAULT 0,
  -- Actions
  website_clicks INTEGER DEFAULT 0,
  phone_calls INTEGER DEFAULT 0,
  direction_requests INTEGER DEFAULT 0,
  bookings INTEGER DEFAULT 0,
  -- Metadata
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure one record per location per date
  UNIQUE(location_id, date)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_gbp_insights_location_id ON gbp_insights_cache(location_id);
CREATE INDEX IF NOT EXISTS idx_gbp_insights_date ON gbp_insights_cache(date);
CREATE INDEX IF NOT EXISTS idx_gbp_insights_location_date ON gbp_insights_cache(location_id, date);

-- Enable RLS
ALTER TABLE gbp_insights_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read all insights
CREATE POLICY "Allow authenticated users to read gbp_insights_cache"
  ON gbp_insights_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policy: Allow service role to insert/update insights (for cron sync)
CREATE POLICY "Allow service role to insert gbp_insights_cache"
  ON gbp_insights_cache
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Allow service role to update gbp_insights_cache"
  ON gbp_insights_cache
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Also allow authenticated users to insert/update for manual syncs
CREATE POLICY "Allow authenticated users to insert gbp_insights_cache"
  ON gbp_insights_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update gbp_insights_cache"
  ON gbp_insights_cache
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comment on table
COMMENT ON TABLE gbp_insights_cache IS 'Cache of Google Business Profile performance metrics per location per day';
