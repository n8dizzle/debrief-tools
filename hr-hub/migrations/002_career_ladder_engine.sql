-- 002: Career Ladder engine — config-driven, multi-role ladders.
-- Additive + backward-compatible: new tables, plus new columns on the existing
-- per-tech state tables (old columns kept until the new app code deploys).

-- ── Ladder definition (manager-editable) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_ladders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  description        TEXT,
  st_business_units  TEXT[] NOT NULL DEFAULT '{}',   -- ap_technicians.business_unit_name values that populate the roster
  is_active          BOOLEAN NOT NULL DEFAULT true,
  sort_order         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         UUID
);

CREATE TABLE IF NOT EXISTS hr_ladder_levels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ladder_id   UUID NOT NULL REFERENCES hr_ladders(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  subtitle    TEXT,
  gate_note   TEXT,             -- promotion gate to the next level
  timeframe   TEXT,             -- optional, e.g. "1–4 years"
  sort_order  INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_hr_levels_ladder ON hr_ladder_levels(ladder_id);

CREATE TABLE IF NOT EXISTS hr_ladder_tiers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id    UUID NOT NULL REFERENCES hr_ladder_levels(id) ON DELETE CASCADE,
  pay_label   TEXT,             -- "$18 / hr", "4% (≈ $600/$15K)", or null
  pay_value   NUMERIC,          -- optional, for auto-placement hints
  pay_kind    TEXT,             -- 'hourly' | 'commission' | 'other' | null
  gate_note   TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT false,  -- single auto-tier for level-only ladders
  sort_order  INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_hr_tiers_level ON hr_ladder_tiers(level_id);

CREATE TABLE IF NOT EXISTS hr_ladder_buckets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ladder_id   UUID NOT NULL REFERENCES hr_ladders(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_gate     BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_hr_buckets_ladder ON hr_ladder_buckets(ladder_id);

CREATE TABLE IF NOT EXISTS hr_ladder_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id     UUID NOT NULL REFERENCES hr_ladder_tiers(id) ON DELETE CASCADE,
  bucket_id   UUID NOT NULL REFERENCES hr_ladder_buckets(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  is_gate     BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_hr_items_tier ON hr_ladder_items(tier_id);
CREATE INDEX IF NOT EXISTS idx_hr_items_bucket ON hr_ladder_items(bucket_id);

-- ── Promotion history (feeds "is the process working") ───────────────────────
CREATE TABLE IF NOT EXISTS hr_tech_ladder_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_technician_id  BIGINT NOT NULL,
  ladder_id         UUID,
  from_tier_id      UUID,
  to_tier_id        UUID,
  changed_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_ladder_events_tech ON hr_tech_ladder_events(st_technician_id);

-- ── Evolve per-tech state (additive; keep old columns for the deploy window) ──
ALTER TABLE hr_tech_ladder       ADD COLUMN IF NOT EXISTS ladder_id       UUID;
ALTER TABLE hr_tech_ladder       ADD COLUMN IF NOT EXISTS current_tier_id UUID;
ALTER TABLE hr_tech_skill_status ADD COLUMN IF NOT EXISTS item_id         UUID;

-- New upsert key for checkoffs (nulls are distinct, so transitional null item_id rows are fine).
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_skill_status_tech_item
  ON hr_tech_skill_status(st_technician_id, item_id);
