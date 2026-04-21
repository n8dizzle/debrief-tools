-- Add the global Triple Win toggle to ref_settings.
-- Triple Win used to be a per-referrer opt-in (ref_referrers.triple_win_enabled).
-- Product shift: it's now a company-wide policy, admin-controlled.
-- When ON, every referral from a referrer who has picked a charity triggers
-- the charity match at submission time (snapshotted into ref_referrals).

INSERT INTO ref_settings (key, value, label, description) VALUES
  (
    'triple_win_enabled',
    'true',
    'Triple Win (charity match) enabled globally',
    'When ON, every referral from a referrer who has picked a charity triggers a matched donation to that charity. When OFF, no new referrals will trigger charity donations (in-flight referrals keep their submission-time snapshot). Accepts "true" or "false".'
  )
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description;
