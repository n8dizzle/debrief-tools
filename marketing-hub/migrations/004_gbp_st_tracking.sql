-- Add tracking_phone column to google_locations table
-- This allows linking GBP locations to ServiceTitan call tracking numbers

ALTER TABLE google_locations ADD COLUMN IF NOT EXISTS tracking_phone TEXT;

-- Create index for efficient lookups by tracking phone
CREATE INDEX IF NOT EXISTS idx_google_locations_tracking_phone
  ON google_locations(tracking_phone) WHERE tracking_phone IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN google_locations.tracking_phone IS 'ServiceTitan call tracking phone number for this GBP location (digits only, e.g., 9401234567)';

-- Example usage (user should populate with actual tracking numbers):
-- UPDATE google_locations SET tracking_phone = '9401234567' WHERE short_name = 'Argyle';
-- UPDATE google_locations SET tracking_phone = '9401234568' WHERE short_name = 'Prosper';
