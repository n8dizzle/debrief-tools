-- Migration 009: Flat Triple-Win program — schema + save RPC + tier-identity trigger.
--
-- Part of the "simplify referrals to flat triple-win" plan (referrals/plans/triple-win-simplify.md).
-- This is PR1 of 2. PR2 handles kill-switch deletion and dead-column cleanup.
--
-- Adds:
--   1. campaign_label column on ref_reward_configs (drives promo banners)
--   2. update_active_program() RPC — single-transaction save with $0 guardrail
--   3. enforce_tier_identity() trigger — DB invariant that all 4 tiers of the
--      active flat config stay identical on {referrer, friend, charity} amounts
--
-- ref_reward_config_change_log already has change_type + before_json + after_json
-- (from migration 001), so no schema change needed there — the RPC writes a
-- single row with change_type='active_program_update'.

-- ============================================================================
-- 1. campaign_label column
-- ============================================================================

ALTER TABLE ref_reward_configs
  ADD COLUMN IF NOT EXISTS campaign_label TEXT;

COMMENT ON COLUMN ref_reward_configs.campaign_label IS
  'Optional promo banner text shown on /dashboard, /refer/[code], /enroll when set. '
  'NULL means no active campaign. Example: "Double Your Charity — April".';

-- ============================================================================
-- 2. update_active_program() RPC
-- ============================================================================
-- Atomically writes the flat program values to all 4 tier rows of the active
-- default config, plus the campaign_label on the config row, plus a single
-- change-log entry. $0 guardrail enforced at the DB layer (defense in depth
-- alongside the UI validator).

CREATE OR REPLACE FUNCTION update_active_program(
  p_referrer_amount NUMERIC,
  p_friend_amount NUMERIC,
  p_charity_amount NUMERIC,
  p_campaign_label TEXT,
  p_admin_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_config_id UUID;
  v_before JSONB;
  v_after JSONB;
  v_change_log_id UUID;
BEGIN
  -- Guardrail: no zero or negative amounts. Protects the "Triple Win always
  -- stays a triple" invariant at the data layer.
  IF p_referrer_amount < 1 OR p_friend_amount < 1 OR p_charity_amount < 1 THEN
    RAISE EXCEPTION 'All three reward amounts must be at least $1 (received referrer=%, friend=%, charity=%)',
      p_referrer_amount, p_friend_amount, p_charity_amount
      USING ERRCODE = 'check_violation';
  END IF;

  -- Locate the active default config. There's exactly one due to
  -- idx_ref_reward_configs_single_default (from migration 001).
  SELECT id INTO v_config_id
  FROM ref_reward_configs
  WHERE is_active = true AND is_default = true
  LIMIT 1;

  IF v_config_id IS NULL THEN
    RAISE EXCEPTION 'No active default reward config found. Run migration 010 to seed.'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Capture BEFORE snapshot for the change log.
  SELECT jsonb_build_object(
    'referrer_amount', MIN(flat_reward_amount),
    'friend_amount', MIN(referee_discount_amount),
    'charity_amount', MIN(charity_match_flat),
    'campaign_label', (SELECT campaign_label FROM ref_reward_configs WHERE id = v_config_id)
  ) INTO v_before
  FROM ref_reward_tiers
  WHERE reward_config_id = v_config_id;

  -- Write all 4 tier rows in one statement. The enforce_tier_identity trigger
  -- is DEFERRABLE INITIALLY DEFERRED, so the check runs at COMMIT time when
  -- all rows are consistent.
  UPDATE ref_reward_tiers
  SET
    reward_mode = 'FLAT',
    flat_reward_amount = p_referrer_amount,
    percentage_of_invoice = NULL,
    percentage_reward_cap = NULL,
    invoice_tier_json = NULL,
    min_invoice_total = 0,
    max_invoice_total = NULL,
    referee_discount_amount = p_friend_amount,
    referee_discount_type = 'FLAT_OFF',
    referee_discount_label = '$' || p_friend_amount::INT || ' off first service',
    charity_match_mode = 'FLAT',
    charity_match_percent = NULL,
    charity_match_flat = p_charity_amount,
    charity_match_floor = 0,
    charity_match_cap = NULL,
    requires_admin_approval = false,
    updated_at = NOW()
  WHERE reward_config_id = v_config_id;

  -- Write the campaign label on the config row.
  UPDATE ref_reward_configs
  SET campaign_label = p_campaign_label,
      updated_at = NOW()
  WHERE id = v_config_id;

  -- Capture AFTER snapshot.
  v_after := jsonb_build_object(
    'referrer_amount', p_referrer_amount,
    'friend_amount', p_friend_amount,
    'charity_amount', p_charity_amount,
    'campaign_label', p_campaign_label
  );

  -- Single change-log row per save.
  INSERT INTO ref_reward_config_change_log (
    reward_config_id, changed_by_admin_id, change_type, before_json, after_json
  ) VALUES (
    v_config_id, p_admin_id, 'active_program_update', v_before, v_after
  )
  RETURNING id INTO v_change_log_id;

  RETURN v_change_log_id;
END;
$$;

COMMENT ON FUNCTION update_active_program IS
  'Atomically saves the flat Triple Win program: writes all 4 tiers of the '
  'active default config with identical values, updates campaign_label on the '
  'config row, and appends one row to ref_reward_config_change_log. Raises '
  'check_violation if any amount < $1. Returns the change-log id.';

-- ============================================================================
-- 3. enforce_tier_identity() trigger
-- ============================================================================
-- Prevents rogue writers (direct SQL, future endpoints, future devs) from
-- splitting the 4 tiers to different values. Outside-voice flagged this as a
-- landmine during eng review: the RPC is the only path that keeps them in
-- sync, but nothing at the DB layer enforces it.
--
-- CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED fires at COMMIT time
-- rather than per-row, which means:
--   - Multi-row UPDATE (from the RPC) checks consistency once after all 4
--     rows settle.
--   - Multi-row INSERT (from the seed in migration 010) checks once at the
--     end of the transaction when all 4 rows exist.

CREATE OR REPLACE FUNCTION enforce_tier_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_referrer_set NUMERIC[];
  v_friend_set NUMERIC[];
  v_charity_set NUMERIC[];
BEGIN
  -- Gather the distinct values for this config across all its tiers.
  SELECT
    ARRAY_AGG(DISTINCT flat_reward_amount),
    ARRAY_AGG(DISTINCT referee_discount_amount),
    ARRAY_AGG(DISTINCT charity_match_flat)
  INTO v_referrer_set, v_friend_set, v_charity_set
  FROM ref_reward_tiers
  WHERE reward_config_id = NEW.reward_config_id;

  -- If any array has more than one distinct value, the 4 tiers disagree.
  IF array_length(v_referrer_set, 1) > 1
     OR array_length(v_friend_set, 1) > 1
     OR array_length(v_charity_set, 1) > 1
  THEN
    RAISE EXCEPTION
      'ref_reward_tiers rows for config % must have identical {flat_reward_amount, referee_discount_amount, charity_match_flat}. '
      'Found: referrer=%, friend=%, charity=%. Use update_active_program() to edit the flat program.',
      NEW.reward_config_id, v_referrer_set, v_friend_set, v_charity_set
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER enforce_tier_identity_trigger
  AFTER INSERT OR UPDATE ON ref_reward_tiers
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION enforce_tier_identity();

COMMENT ON FUNCTION enforce_tier_identity IS
  'Trigger function: enforces that all ref_reward_tiers rows sharing a config '
  'have identical flat_reward_amount, referee_discount_amount, and charity_match_flat. '
  'Deferred to COMMIT time so multi-row writes in a transaction are OK.';
