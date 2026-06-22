-- Migration 016: track when a referral's ServiceTitan customer was tagged
-- with the Referral Code (via the admin "Set Referral Code in ST" action).
-- Lets the admin UI show a persisted "✓ Referral code set" state instead of
-- re-prompting the action on every page load.

ALTER TABLE ref_referrals
  ADD COLUMN IF NOT EXISTS tagged_in_st_at TIMESTAMPTZ;
