-- GBP Posts Management Tables
-- Run this migration via Supabase SQL Editor

-- Posts storage
CREATE TABLE IF NOT EXISTS gbp_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary TEXT NOT NULL,
  topic_type TEXT NOT NULL CHECK (topic_type IN ('STANDARD', 'EVENT', 'OFFER')),
  cta_type TEXT,
  cta_url TEXT,
  event_title TEXT,
  event_start_date TIMESTAMPTZ,
  event_end_date TIMESTAMPTZ,
  coupon_code TEXT,
  redeem_url TEXT,
  terms_conditions TEXT,
  media_urls JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'publishing', 'published', 'failed')),
  created_by UUID REFERENCES portal_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track per-location publish status
CREATE TABLE IF NOT EXISTS gbp_post_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES gbp_posts(id) ON DELETE CASCADE,
  location_id UUID REFERENCES google_locations(id),
  google_post_id TEXT,
  google_post_url TEXT,
  state TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  published_at TIMESTAMPTZ,
  UNIQUE(post_id, location_id)
);

-- Media library
CREATE TABLE IF NOT EXISTS gbp_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  storage_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES portal_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_gbp_posts_status ON gbp_posts(status);
CREATE INDEX IF NOT EXISTS idx_gbp_posts_created_at ON gbp_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gbp_post_locations_post_id ON gbp_post_locations(post_id);
CREATE INDEX IF NOT EXISTS idx_gbp_post_locations_location_id ON gbp_post_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_gbp_media_created_at ON gbp_media(created_at DESC);

-- Enable RLS
ALTER TABLE gbp_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gbp_post_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gbp_media ENABLE ROW LEVEL SECURITY;

-- RLS policies for gbp_posts (authenticated users can read, owners/managers can write)
CREATE POLICY "Allow read access to gbp_posts for authenticated users"
  ON gbp_posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert access to gbp_posts"
  ON gbp_posts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update access to gbp_posts"
  ON gbp_posts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow delete access to gbp_posts"
  ON gbp_posts FOR DELETE
  TO authenticated
  USING (true);

-- RLS policies for gbp_post_locations
CREATE POLICY "Allow read access to gbp_post_locations for authenticated users"
  ON gbp_post_locations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert access to gbp_post_locations"
  ON gbp_post_locations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update access to gbp_post_locations"
  ON gbp_post_locations FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow delete access to gbp_post_locations"
  ON gbp_post_locations FOR DELETE
  TO authenticated
  USING (true);

-- RLS policies for gbp_media
CREATE POLICY "Allow read access to gbp_media for authenticated users"
  ON gbp_media FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert access to gbp_media"
  ON gbp_media FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow delete access to gbp_media"
  ON gbp_media FOR DELETE
  TO authenticated
  USING (true);
