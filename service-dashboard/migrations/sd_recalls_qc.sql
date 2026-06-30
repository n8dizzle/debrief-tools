-- Recalls / Quality (QC) feature — extends the recall base + adds investigation tables.
-- Authored from LIVE schema introspection 2026-06-30 (migrations/ dir runs stale vs prod).
--
-- BLAST-RADIUS NOTE: sd_recalls_caused is read by the leaderboard (app/api/leaderboard/route.ts),
-- which filters by caused_by_tech_id + recall_created_on ONLY (no BU filter). After this migration
-- the recall sync widens to ALL business units + long history, so the leaderboard query MUST add a
-- service-BU filter (uses the new business_unit_id) to keep its "recalls caused" number unchanged.
-- A regression test guards that. "Widen the data, narrow the read."

-- ── 1. Enrich the existing recall table (additive, all nullable → no backfill break) ──
ALTER TABLE sd_recalls_caused
  ADD COLUMN IF NOT EXISTS business_unit_id        integer,
  ADD COLUMN IF NOT EXISTS trade                   text,      -- 'hvac' | 'plumbing'
  ADD COLUMN IF NOT EXISTS job_type_name           text,
  ADD COLUMN IF NOT EXISTS st_location_id          bigint,
  ADD COLUMN IF NOT EXISTS st_original_completed_date date,
  ADD COLUMN IF NOT EXISTS days_to_recall          integer,   -- recomputed every sync (never frozen)
  ADD COLUMN IF NOT EXISTS equipment_id            bigint;    -- nullable; coverage is partial by design

CREATE INDEX IF NOT EXISTS idx_sd_recalls_caused_bu       ON sd_recalls_caused(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_sd_recalls_caused_location ON sd_recalls_caused(st_location_id);

-- ── 2. Cached installed equipment (locationIds plural filter works; quality good, coverage partial) ──
CREATE TABLE IF NOT EXISTS sd_equipment (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  st_equipment_id bigint UNIQUE NOT NULL,
  st_location_id  bigint NOT NULL,
  st_customer_id  bigint,
  name            text,
  manufacturer    text,
  model           text,
  type            text,
  serial_number   text,
  installed_on    date,
  cost            numeric(12,2),
  synced_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sd_equipment_location ON sd_equipment(st_location_id);

-- ── 3. Investigation workflow ──
CREATE TABLE IF NOT EXISTS sd_recall_investigations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  st_recall_job_id    integer UNIQUE NOT NULL,   -- 1:1 with a recall (also FK target below)
  status              text NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open','investigating','resolved')),
  root_cause_category text,                       -- NOT NULL enforced at app layer on resolve
  root_cause_note     text,
  assigned_to         uuid,                        -- portal_users(id)
  opened_by           uuid,
  resolved_by         uuid,
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sd_investigations_status ON sd_recall_investigations(status);
CREATE INDEX IF NOT EXISTS idx_sd_investigations_assigned ON sd_recall_investigations(assigned_to);

-- Investigations can also be opened on a NON-recall job ("search a job that went wrong").
-- st_recall_job_id holds the job id either way; recall vs not is derivable from sd_recalls_caused.

CREATE TABLE IF NOT EXISTS sd_research_questions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES sd_recall_investigations(id) ON DELETE CASCADE,
  question         text NOT NULL,
  assigned_to      uuid,                            -- portal_users(id)
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered')),
  answer           text,
  answered_by      uuid,
  answered_at      timestamptz,
  deleted_at       timestamptz,                     -- soft delete while investigation open
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sd_questions_investigation
  ON sd_research_questions(investigation_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sd_recall_activity (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid REFERENCES sd_recall_investigations(id) ON DELETE CASCADE,
  actor            uuid,                            -- portal_users(id)
  action           text NOT NULL,                   -- e.g. 'opened','status_changed','question_added','question_answered','resolved','reopened'
  detail           jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sd_recall_activity_inv ON sd_recall_activity(investigation_id);
