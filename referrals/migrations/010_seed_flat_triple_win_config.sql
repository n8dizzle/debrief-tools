-- Migration 010: Wipe test transactional data, seed the new flat Triple Win config.
--
-- Part of the "simplify referrals to flat triple-win" plan, PR1. User confirmed
-- 2026-04-22 that all existing transactional data is test data and safe to wipe.
-- A point-in-time Supabase backup is taken immediately before running this
-- migration (see the plan's Failure Modes section).
--
-- Order matters:
--   1. Truncate transactional tables (CASCADE handles FK chain).
--   2. Delete old reward configs + tiers. No in-flight referrals reference
--      them after step 1, so outright delete is safe.
--   3. Seed the new flat config + 4 identical tiers. The enforce_tier_identity
--      trigger from migration 009 is DEFERRABLE, so the 4 inserts pass the
--      check at COMMIT time when all 4 rows settle with identical values.
--   4. Pin triple_win_enabled = 'true' in ref_settings. PR1 leaves the kill-
--      switch code alive; PR2 deletes it. Pinning ensures it stays effectively
--      on until then.

-- ============================================================================
-- 1. Wipe transactional tables
-- ============================================================================

TRUNCATE
  ref_referrers,
  ref_referrals,
  ref_rewards,
  ref_charity_donations,
  ref_webhook_events
CASCADE;

-- ============================================================================
-- 2. Delete old reward configs and their tiers
-- ============================================================================
-- ref_reward_tiers.reward_config_id has ON DELETE CASCADE (migration 001:37),
-- so deleting configs cleans up tiers. ref_reward_config_change_log.reward_config_id
-- is ON DELETE SET NULL — historical log entries survive as orphan references.

DELETE FROM ref_reward_configs;

-- ============================================================================
-- 3. Seed the new flat "Triple Win Flat 2026" config
-- ============================================================================

DO $$
DECLARE
  v_config_id UUID;
BEGIN
  INSERT INTO ref_reward_configs (
    name, description, is_active, is_default, traffic_allocation,
    effective_from, campaign_label
  )
  VALUES (
    'Triple Win Flat 2026',
    'Flat $50 / $50 / $50 program. Service category is no longer differentiated — all 4 tier rows stay identical (enforced by enforce_tier_identity trigger). Edit via /admin/config, which calls update_active_program() RPC.',
    true,
    true,
    100,
    NOW(),
    NULL
  )
  RETURNING id INTO v_config_id;

  -- Insert 4 identical tiers, one per service category (schema requires all 4
  -- due to UNIQUE (reward_config_id, service_category)). Values are identical
  -- so resolveTierForConversion() returns the same payout regardless of
  -- which category the eventual conversion falls into.
  INSERT INTO ref_reward_tiers (
    reward_config_id, service_category, service_category_label,
    reward_mode, flat_reward_amount,
    min_invoice_total,
    referee_discount_amount, referee_discount_type, referee_discount_label,
    charity_match_mode, charity_match_flat, charity_match_floor, charity_match_cap,
    requires_admin_approval, is_active
  )
  VALUES
    (v_config_id, 'SERVICE_CALL', 'Service Call or Repair',
     'FLAT', 50, 0,
     50, 'FLAT_OFF', '$50 off first service',
     'FLAT', 50, 0, NULL,
     false, true),

    (v_config_id, 'MAINTENANCE', 'Maintenance Membership',
     'FLAT', 50, 0,
     50, 'FLAT_OFF', '$50 off first service',
     'FLAT', 50, 0, NULL,
     false, true),

    (v_config_id, 'REPLACEMENT', 'HVAC or Water Heater Replacement',
     'FLAT', 50, 0,
     50, 'FLAT_OFF', '$50 off first service',
     'FLAT', 50, 0, NULL,
     false, true),

    (v_config_id, 'COMMERCIAL', 'Commercial',
     'FLAT', 50, 0,
     50, 'FLAT_OFF', '$50 off first service',
     'FLAT', 50, 0, NULL,
     false, true);
END $$;

-- ============================================================================
-- 4. Pin the kill-switch to true
-- ============================================================================
-- PR1 hides triple_win_enabled from /admin/settings (code change) and pins it
-- here. Together these prevent anyone from flipping it to false. PR2 drops
-- the setting row and deletes the 14 `if (tripleWinEnabled)` branches.

UPDATE ref_settings
SET value = 'true',
    updated_at = NOW()
WHERE key = 'triple_win_enabled';
