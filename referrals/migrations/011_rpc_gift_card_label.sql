-- Migration 011: fix the friend-leg label written by update_active_program().
--
-- Before: the RPC wrote referee_discount_label = '$<N> off first service'.
-- Reality: the friend ALSO gets a gift card (not a service discount), same
-- as the referrer, from the Tremendous catalog at redemption. Update the RPC
-- to write an accurate label, and backfill the one existing active tier's
-- label so nothing downstream reads the old misleading string.

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
  IF p_referrer_amount < 1 OR p_friend_amount < 1 OR p_charity_amount < 1 THEN
    RAISE EXCEPTION 'All three reward amounts must be at least $1 (received referrer=%, friend=%, charity=%)',
      p_referrer_amount, p_friend_amount, p_charity_amount
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT id INTO v_config_id
  FROM ref_reward_configs
  WHERE is_active = true AND is_default = true
  LIMIT 1;

  IF v_config_id IS NULL THEN
    RAISE EXCEPTION 'No active default reward config found. Run migration 010 to seed.'
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT jsonb_build_object(
    'referrer_amount', MIN(flat_reward_amount),
    'friend_amount', MIN(referee_discount_amount),
    'charity_amount', MIN(charity_match_flat),
    'campaign_label', (SELECT campaign_label FROM ref_reward_configs WHERE id = v_config_id)
  ) INTO v_before
  FROM ref_reward_tiers
  WHERE reward_config_id = v_config_id;

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
    -- Column is legacy-named referee_discount_label but the value is the
    -- friend's gift card amount now (a thank-you, not a service discount).
    referee_discount_label = '$' || p_friend_amount::INT || ' gift card',
    charity_match_mode = 'FLAT',
    charity_match_percent = NULL,
    charity_match_flat = p_charity_amount,
    charity_match_floor = 0,
    charity_match_cap = NULL,
    requires_admin_approval = false,
    updated_at = NOW()
  WHERE reward_config_id = v_config_id;

  UPDATE ref_reward_configs
  SET campaign_label = p_campaign_label,
      updated_at = NOW()
  WHERE id = v_config_id;

  v_after := jsonb_build_object(
    'referrer_amount', p_referrer_amount,
    'friend_amount', p_friend_amount,
    'charity_amount', p_charity_amount,
    'campaign_label', p_campaign_label
  );

  INSERT INTO ref_reward_config_change_log (
    reward_config_id, changed_by_admin_id, change_type, before_json, after_json
  ) VALUES (
    v_config_id, p_admin_id, 'active_program_update', v_before, v_after
  )
  RETURNING id INTO v_change_log_id;

  RETURN v_change_log_id;
END;
$$;

-- One-time backfill: rewrite the existing seed's misleading label without
-- changing amounts. Targets the active default config's tiers directly so
-- the value on disk matches the new copy right away.
UPDATE ref_reward_tiers
SET referee_discount_label = '$' || referee_discount_amount::INT || ' gift card',
    updated_at = NOW()
WHERE reward_config_id IN (
  SELECT id FROM ref_reward_configs WHERE is_active = true AND is_default = true
);
