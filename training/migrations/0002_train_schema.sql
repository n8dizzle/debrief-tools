-- Phase 1 real schema for the Training Management System.
-- Full platform (Approach B) data model, additive-ready: Phase 1 uses the core
-- (people, trainings, steps, assignments, completions, magic_links, sms_log);
-- roles/requirements/otp are created now so later phases bolt on with no rewrite.
-- Deferred per eng review: train_video_assets, the "module" step type.

-- ============================================================
-- ROSTER
-- ============================================================
CREATE TABLE IF NOT EXISTS train_people (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text NOT NULL DEFAULT 'manual',      -- servicetitan | portal | manual
  st_id         bigint,                               -- ServiceTitan technician id (stable identity)
  portal_id     uuid,                                 -- portal_users.id (stable identity)
  name          text NOT NULL,
  phone         text,                                 -- E.164
  email         text,
  title         text,
  active        boolean NOT NULL DEFAULT true,
  sms_opt_out   boolean NOT NULL DEFAULT false,
  sms_opt_out_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- Stable-ID uniqueness (never dedup on phone — handsets get reassigned).
CREATE UNIQUE INDEX IF NOT EXISTS train_people_st_id_uniq   ON train_people (st_id)     WHERE st_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS train_people_portal_uniq  ON train_people (portal_id) WHERE portal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS train_people_phone_idx ON train_people (phone);
CREATE INDEX IF NOT EXISTS train_people_active_idx ON train_people (active);

CREATE TABLE IF NOT EXISTS train_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  st_role_id  bigint,                                 -- optional ServiceTitan role mapping
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS train_person_roles (
  person_id  uuid NOT NULL REFERENCES train_people(id) ON DELETE CASCADE,
  role_id    uuid NOT NULL REFERENCES train_roles(id)  ON DELETE CASCADE,
  PRIMARY KEY (person_id, role_id)
);

-- ============================================================
-- CONTENT
-- ============================================================
CREATE TABLE IF NOT EXISTS train_trainings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  status        text NOT NULL DEFAULT 'draft',        -- draft | published | archived
  is_recurring  boolean NOT NULL DEFAULT false,
  recurrence_interval_months integer,
  created_by    uuid,                                 -- portal_users.id
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- A training is an ordered list of steps. Per-type config lives in config JSONB:
--   video     -> { source: 'link'|'upload', url, min_watch_pct }
--   document  -> { url, source: 'link'|'upload' }   (native embed + "I've read this")
--   quiz      -> { pass_threshold, max_attempts, shuffle, questions:[{prompt, choices:[], correct_index}] }
--   signature -> { policy_text }                     (Phase 2, OTP-gated)
CREATE TABLE IF NOT EXISTS train_steps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id  uuid NOT NULL REFERENCES train_trainings(id) ON DELETE CASCADE,
  order_index  integer NOT NULL DEFAULT 0,
  type         text NOT NULL,                         -- video | document | quiz | signature
  required     boolean NOT NULL DEFAULT true,
  config       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS train_steps_training_idx ON train_steps (training_id, order_index);

CREATE TABLE IF NOT EXISTS train_role_requirements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id     uuid NOT NULL REFERENCES train_roles(id)     ON DELETE CASCADE,
  training_id uuid NOT NULL REFERENCES train_trainings(id) ON DELETE CASCADE,
  due_days    integer,
  recurring   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, training_id)
);

-- ============================================================
-- ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS train_assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id    uuid NOT NULL REFERENCES train_trainings(id) ON DELETE CASCADE,
  person_id      uuid NOT NULL REFERENCES train_people(id)    ON DELETE CASCADE,
  assigned_by    uuid,                                -- portal_users.id
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  due_at         timestamptz,
  source         text NOT NULL DEFAULT 'adhoc',       -- adhoc | role | recurring
  status         text NOT NULL DEFAULT 'pending',     -- pending|in_progress|completed|overdue|expired|undeliverable|revoked
  current_step_index integer NOT NULL DEFAULT 0,
  cycle_key      text NOT NULL DEFAULT 'once',        -- non-null so the unique index actually dedups (Postgres NULLs are distinct)
  completed_at   timestamptz,
  revoked_at     timestamptz,
  revoked_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
-- One training per person per cycle, across adhoc/role/recurring sources.
CREATE UNIQUE INDEX IF NOT EXISTS train_assignments_dedup
  ON train_assignments (training_id, person_id, cycle_key);
CREATE INDEX IF NOT EXISTS train_assignments_person_idx ON train_assignments (person_id);
CREATE INDEX IF NOT EXISTS train_assignments_status_idx ON train_assignments (status);

-- Append-only completion audit. Never UPDATE/DELETE these rows.
CREATE TABLE IF NOT EXISTS train_step_completions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES train_assignments(id) ON DELETE CASCADE,
  step_id         uuid NOT NULL REFERENCES train_steps(id)       ON DELETE CASCADE,
  completed_at    timestamptz NOT NULL DEFAULT now(),
  quiz_score      numeric,
  quiz_answers    jsonb,
  watch_pct       numeric,
  signature_image_url text,
  signature_typed_name text,
  verified_via    text NOT NULL DEFAULT 'link',       -- link | sms_otp
  ip              text,
  user_agent      text,
  from_phone      text
);
CREATE UNIQUE INDEX IF NOT EXISTS train_step_completions_uniq
  ON train_step_completions (assignment_id, step_id);

-- ============================================================
-- AUTH (tech magic-link) + SMS
-- ============================================================
-- Person-scoped durable token -> opens the training inbox. Hashed at rest.
CREATE TABLE IF NOT EXISTS train_magic_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id    uuid NOT NULL REFERENCES train_people(id) ON DELETE CASCADE,
  token_hash   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  last_used_at timestamptz,
  revoked_at   timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS train_magic_links_token_idx ON train_magic_links (token_hash);
CREATE INDEX IF NOT EXISTS train_magic_links_person_idx ON train_magic_links (person_id);

-- OTP step-up (Phase 2 signatures).
CREATE TABLE IF NOT EXISTS train_otp_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id   uuid NOT NULL REFERENCES train_people(id) ON DELETE CASCADE,
  code_hash   text NOT NULL,
  purpose     text NOT NULL DEFAULT 'signature',
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,
  consumed_at timestamptz,
  attempts    integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS train_sms_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       uuid REFERENCES train_people(id) ON DELETE SET NULL,
  assignment_id   uuid REFERENCES train_assignments(id) ON DELETE SET NULL,
  direction       text NOT NULL DEFAULT 'outbound',
  body            text,
  provider_msg_id text,
  status          text,                                -- accepted | failed | delivered | ...
  created_at      timestamptz NOT NULL DEFAULT now()
);
