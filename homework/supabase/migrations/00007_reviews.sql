-- =============================================
-- Migration 00007: Reviews
-- =============================================
-- 5-dimension ratings + text + photos + contractor response

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  order_item_id UUID NOT NULL REFERENCES order_items(id),
  reviewer_id UUID NOT NULL REFERENCES user_profiles(id),
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  service_id UUID NOT NULL REFERENCES catalog_services(id),

  -- 5-dimension ratings (1-5)
  rating_overall INTEGER NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_quality INTEGER CHECK (rating_quality BETWEEN 1 AND 5),
  rating_punctuality INTEGER CHECK (rating_punctuality BETWEEN 1 AND 5),
  rating_communication INTEGER CHECK (rating_communication BETWEEN 1 AND 5),
  rating_value INTEGER CHECK (rating_value BETWEEN 1 AND 5),
  rating_cleanliness INTEGER CHECK (rating_cleanliness BETWEEN 1 AND 5),

  -- Content
  title TEXT,
  body TEXT,
  photos TEXT[] DEFAULT '{}', -- URLs to review photos

  -- Contractor response
  response_text TEXT,
  response_at TIMESTAMPTZ,

  -- Moderation
  is_verified BOOLEAN DEFAULT TRUE, -- verified purchase
  is_visible BOOLEAN DEFAULT TRUE,
  flagged BOOLEAN DEFAULT FALSE,
  flagged_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_contractor ON reviews(contractor_id);
CREATE INDEX idx_reviews_service ON reviews(service_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX idx_reviews_order ON reviews(order_id);
CREATE INDEX idx_reviews_rating ON reviews(rating_overall);

-- Function to update contractor aggregate ratings
CREATE OR REPLACE FUNCTION update_contractor_ratings()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contractors SET
    rating_overall = sub.avg_overall,
    rating_quality = sub.avg_quality,
    rating_punctuality = sub.avg_punctuality,
    rating_communication = sub.avg_communication,
    rating_value = sub.avg_value,
    rating_cleanliness = sub.avg_cleanliness,
    review_count = sub.total_reviews
  FROM (
    SELECT
      contractor_id,
      ROUND(AVG(rating_overall)::numeric, 2) as avg_overall,
      ROUND(AVG(rating_quality)::numeric, 2) as avg_quality,
      ROUND(AVG(rating_punctuality)::numeric, 2) as avg_punctuality,
      ROUND(AVG(rating_communication)::numeric, 2) as avg_communication,
      ROUND(AVG(rating_value)::numeric, 2) as avg_value,
      ROUND(AVG(rating_cleanliness)::numeric, 2) as avg_cleanliness,
      COUNT(*) as total_reviews
    FROM reviews
    WHERE is_visible = TRUE AND contractor_id = COALESCE(NEW.contractor_id, OLD.contractor_id)
    GROUP BY contractor_id
  ) sub
  WHERE contractors.id = sub.contractor_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_ratings_on_review
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_contractor_ratings();

-- Updated_at trigger
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Public read for visible reviews
CREATE POLICY "Public read visible reviews" ON reviews FOR SELECT
  USING (is_visible = TRUE);

-- Users create reviews for their orders
CREATE POLICY "Users create own reviews" ON reviews FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());

-- Users can update their own reviews
CREATE POLICY "Users update own reviews" ON reviews FOR UPDATE
  USING (reviewer_id = auth.uid());

-- Contractors can update response on their reviews
CREATE POLICY "Contractors respond to reviews" ON reviews FOR UPDATE
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid()))
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid()));

-- Admin full access
CREATE POLICY "Admins manage reviews" ON reviews FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
