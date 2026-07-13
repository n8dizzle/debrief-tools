-- Manager-controlled recall root-cause taxonomy (2026-07-07).
--
-- Moves the previously hardcoded ROOT_CAUSE_CATEGORIES (lib/qc-recalls.ts) into a table
-- the service manager can edit from Settings. Investigations keep storing the label TEXT
-- in sd_recall_investigations.root_cause_category exactly as before, so:
--   * Trends (app/api/recalls/trends) keeps grouping by string — zero rewrite.
--   * No backfill: existing rows already hold matching label strings.
-- Archive = set archived_at (soft): the cause disappears from the picker + AI options but
-- still renders on historical recalls and still counts in Trends.
-- Rename cascades a bulk UPDATE of matching investigation rows (done in the app layer) so
-- Trends shows one bucket, not two.

CREATE TABLE IF NOT EXISTS sd_recall_root_causes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  archived_at timestamptz,               -- NULL = active; set to soft-archive
  created_by  uuid,                      -- portal_users(id)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- At most one ACTIVE cause per label (archived duplicates allowed so history is preserved).
CREATE UNIQUE INDEX IF NOT EXISTS uq_sd_root_causes_active_label
  ON sd_recall_root_causes (label) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sd_root_causes_active
  ON sd_recall_root_causes (sort_order) WHERE archived_at IS NULL;

-- Seed with the 8 formerly-hardcoded values, preserving their order.
INSERT INTO sd_recall_root_causes (label, sort_order) VALUES
  ('Install error / workmanship', 0),
  ('Misdiagnosis',                1),
  ('Defective equipment or part', 2),
  ('Wrong part or sizing',        3),
  ('Incomplete repair',           4),
  ('Customer misuse or unrelated',5),
  ('Maintenance-related',         6),
  ('Other',                       7)
ON CONFLICT DO NOTHING;
