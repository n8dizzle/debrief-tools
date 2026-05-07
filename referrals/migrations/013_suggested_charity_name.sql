-- Migration 013: Add suggested_charity_name to ref_referrers
-- Allows referrers to suggest a custom charity not in the predefined list.
-- When set, selected_charity_id will be NULL (no donation made until admin
-- adds the charity to ref_charities and updates the referrer's selection).

ALTER TABLE ref_referrers
  ADD COLUMN IF NOT EXISTS suggested_charity_name TEXT;
