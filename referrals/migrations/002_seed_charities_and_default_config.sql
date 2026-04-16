-- Seed data: initial charity list + Default 2026 Launch reward config
-- Admins can edit everything via the admin UI; these are the starting point, not constraints.

-- ============================================================================
-- CHARITIES
-- ============================================================================

INSERT INTO ref_charities (name, description, website_url, fulfillment_method, display_order)
VALUES
  (
    'Operation Homefront',
    'National nonprofit providing emergency financial assistance, transitional housing, and family support programs to military and veteran families.',
    'https://www.operationhomefront.org',
    'TREMENDOUS',
    1
  ),
  (
    'North Texas Food Bank',
    'Serving 13 counties across North Texas, providing millions of meals annually to neighbors facing food insecurity.',
    'https://ntfb.org',
    'TREMENDOUS',
    2
  ),
  (
    'Flower Mound Cares',
    'Local Flower Mound nonprofit supporting families in our own backyard.',
    NULL,
    'POOLED_QUARTERLY',
    3
  ),
  (
    'Trades Education Scholarship Fund',
    'Supporting the next generation of skilled trade workers through scholarships at Dallas College and Tarrant County College.',
    NULL,
    'DIRECT_PAYMENT',
    4
  )
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- DEFAULT REWARD CONFIG
-- ============================================================================

DO $$
DECLARE
  v_config_id UUID;
BEGIN
  -- Only seed if no default config exists yet
  IF NOT EXISTS (SELECT 1 FROM ref_reward_configs WHERE is_default = true) THEN
    INSERT INTO ref_reward_configs (
      name, description, is_active, is_default,
      traffic_allocation, effective_from
    )
    VALUES (
      'Default 2026 Launch',
      'Initial reward structure at program launch. Edit freely.',
      true,
      true,
      100,
      NOW()
    )
    RETURNING id INTO v_config_id;

    -- Service Call tier
    INSERT INTO ref_reward_tiers (
      reward_config_id, service_category, service_category_label,
      reward_mode, flat_reward_amount,
      min_invoice_total,
      referee_discount_amount, referee_discount_type, referee_discount_label,
      charity_match_mode, charity_match_percent, charity_match_floor, charity_match_cap
    ) VALUES (
      v_config_id, 'SERVICE_CALL', 'Service Call or Repair',
      'FLAT', 50,
      89,
      50, 'FLAT_OFF', '$50 off first service',
      'PERCENTAGE', 20, 10, 25
    );

    -- Maintenance tier
    INSERT INTO ref_reward_tiers (
      reward_config_id, service_category, service_category_label,
      reward_mode, flat_reward_amount,
      min_invoice_total,
      referee_discount_amount, referee_discount_type, referee_discount_label,
      charity_match_mode, charity_match_percent, charity_match_floor, charity_match_cap
    ) VALUES (
      v_config_id, 'MAINTENANCE', 'Maintenance Membership',
      'FLAT', 75,
      0,
      0, 'FREE_MONTH', 'First month free',
      'PERCENTAGE', 20, 15, 25
    );

    -- Replacement tier (tiered by invoice)
    INSERT INTO ref_reward_tiers (
      reward_config_id, service_category, service_category_label,
      reward_mode, invoice_tier_json,
      min_invoice_total,
      referee_discount_amount, referee_discount_type, referee_discount_label,
      charity_match_mode, charity_match_percent, charity_match_floor, charity_match_cap
    ) VALUES (
      v_config_id, 'REPLACEMENT', 'HVAC or Water Heater Replacement',
      'TIERED_BY_INVOICE',
      '[
        {"minInvoice": 3000, "maxInvoice": 7000, "rewardAmount": 250},
        {"minInvoice": 7000, "maxInvoice": 15000, "rewardAmount": 400},
        {"minInvoice": 15000, "maxInvoice": null, "rewardAmount": 500}
      ]'::jsonb,
      3000,
      250, 'FLAT_OFF', '$250 off project',
      'PERCENTAGE', 10, 25, 50
    );

    -- Commercial tier
    INSERT INTO ref_reward_tiers (
      reward_config_id, service_category, service_category_label,
      reward_mode, flat_reward_amount,
      min_invoice_total,
      referee_discount_amount, referee_discount_type, referee_discount_label,
      charity_match_mode, charity_match_percent, charity_match_floor, charity_match_cap,
      requires_admin_approval
    ) VALUES (
      v_config_id, 'COMMERCIAL', 'Commercial Services',
      'FLAT', 500,
      1000,
      0, 'CUSTOM', 'Case-by-case benefit',
      'PERCENTAGE', 10, 50, 100,
      true
    );
  END IF;
END $$;
