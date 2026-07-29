-- HR Hub — Install Progression & Skill Map
-- Per-technician ladder state. The ladder DEFINITION (steps/rungs/skills) is static
-- reference content in lib/ladder.ts; only per-tech placement + checkoffs live here.
-- Roster is read live from ap_technicians (same Supabase project), keyed by st_technician_id.

-- Where a tech currently sits on the ladder (their earned rung) + light meta.
CREATE TABLE IF NOT EXISTS hr_tech_ladder (
  st_technician_id BIGINT PRIMARY KEY,
  current_rung_id  TEXT,               -- matches a lib/ladder.ts rung id, e.g. 'l1_24'
  hire_date        DATE,
  notes            TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       UUID                -- portal_users.id
);

-- Per-skill checkoff. skill_id is the stable string id from lib/ladder.ts
-- (`${rungId}:${category}:${index}`), so no ladder-definition table is required.
CREATE TABLE IF NOT EXISTS hr_tech_skill_status (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_technician_id BIGINT NOT NULL,
  skill_id         TEXT   NOT NULL,
  status           TEXT   NOT NULL DEFAULT 'not_started'
                     CHECK (status IN ('not_started','in_progress','verified')),
  note             TEXT,
  verified_by      UUID,               -- portal_users.id
  verified_at      TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (st_technician_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_tech_skill_status_tech
  ON hr_tech_skill_status (st_technician_id);
