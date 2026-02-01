-- GA4 Analytics Cache Table
-- Run this migration in Supabase SQL Editor
-- Caches Google Analytics 4 metrics (filtered to US traffic only)

-- Daily traffic metrics cache
CREATE TABLE IF NOT EXISTS ga4_daily_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  -- Traffic metrics
  sessions INTEGER DEFAULT 0,
  users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  pageviews INTEGER DEFAULT 0,
  bounce_rate DECIMAL(5,4) DEFAULT 0, -- Stored as decimal (0.5 = 50%)
  avg_session_duration DECIMAL(10,2) DEFAULT 0, -- In seconds
  engagement_rate DECIMAL(5,4) DEFAULT 0,
  -- Metadata
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Traffic sources cache (aggregated by source/medium per date)
CREATE TABLE IF NOT EXISTS ga4_sources_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  source VARCHAR(255) NOT NULL,
  medium VARCHAR(255) NOT NULL,
  sessions INTEGER DEFAULT 0,
  users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  bounce_rate DECIMAL(5,4) DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, source, medium)
);

-- Top pages cache (aggregated per date)
CREATE TABLE IF NOT EXISTS ga4_pages_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  page_path VARCHAR(500) NOT NULL,
  page_title VARCHAR(500),
  pageviews INTEGER DEFAULT 0,
  unique_pageviews INTEGER DEFAULT 0,
  avg_time_on_page DECIMAL(10,2) DEFAULT 0,
  bounce_rate DECIMAL(5,4) DEFAULT 0,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, page_path)
);

-- Conversion events cache
CREATE TABLE IF NOT EXISTS ga4_conversions_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  event_count INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, event_name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ga4_daily_date ON ga4_daily_cache(date);
CREATE INDEX IF NOT EXISTS idx_ga4_sources_date ON ga4_sources_cache(date);
CREATE INDEX IF NOT EXISTS idx_ga4_pages_date ON ga4_pages_cache(date);
CREATE INDEX IF NOT EXISTS idx_ga4_conversions_date ON ga4_conversions_cache(date);

-- Enable RLS on all tables
ALTER TABLE ga4_daily_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_sources_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_pages_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_conversions_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ga4_daily_cache
CREATE POLICY "Allow authenticated users to read ga4_daily_cache"
  ON ga4_daily_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow service role full access to ga4_daily_cache"
  ON ga4_daily_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert ga4_daily_cache"
  ON ga4_daily_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update ga4_daily_cache"
  ON ga4_daily_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for ga4_sources_cache
CREATE POLICY "Allow authenticated users to read ga4_sources_cache"
  ON ga4_sources_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow service role full access to ga4_sources_cache"
  ON ga4_sources_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert ga4_sources_cache"
  ON ga4_sources_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update ga4_sources_cache"
  ON ga4_sources_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for ga4_pages_cache
CREATE POLICY "Allow authenticated users to read ga4_pages_cache"
  ON ga4_pages_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow service role full access to ga4_pages_cache"
  ON ga4_pages_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert ga4_pages_cache"
  ON ga4_pages_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update ga4_pages_cache"
  ON ga4_pages_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for ga4_conversions_cache
CREATE POLICY "Allow authenticated users to read ga4_conversions_cache"
  ON ga4_conversions_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow service role full access to ga4_conversions_cache"
  ON ga4_conversions_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert ga4_conversions_cache"
  ON ga4_conversions_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update ga4_conversions_cache"
  ON ga4_conversions_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Comments
COMMENT ON TABLE ga4_daily_cache IS 'Daily aggregate traffic metrics from GA4 (US traffic only)';
COMMENT ON TABLE ga4_sources_cache IS 'Traffic source/medium breakdown per day from GA4';
COMMENT ON TABLE ga4_pages_cache IS 'Top pages metrics per day from GA4';
COMMENT ON TABLE ga4_conversions_cache IS 'Conversion event counts per day from GA4';
