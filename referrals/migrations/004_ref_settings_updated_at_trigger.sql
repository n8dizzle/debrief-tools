-- Auto-maintain ref_settings.updated_at on every UPDATE so the column is
-- authoritative regardless of caller. setSetting() already sets it manually,
-- but a SQL shell edit or a future code path would otherwise leave it stale.

CREATE OR REPLACE FUNCTION ref_settings_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ref_settings_updated_at ON ref_settings;

CREATE TRIGGER ref_settings_updated_at
  BEFORE UPDATE ON ref_settings
  FOR EACH ROW
  EXECUTE FUNCTION ref_settings_set_updated_at();
