-- Settings key-value store for the referrals app.
-- Runtime config that can change without a redeploy (e.g. the ServiceTitan
-- campaign ID that incoming referral leads should attribute to).

CREATE TABLE IF NOT EXISTS ref_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  label TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

-- Seed known settings. Values start NULL so the admin UI prompts for them.
INSERT INTO ref_settings (key, label, description) VALUES
  (
    'st_referral_campaign_id',
    'ServiceTitan referral campaign ID',
    'Every referred customer''s lead attributes to this campaign in ServiceTitan. Find the ID in ST → Marketing → Campaigns. Leave blank to stop sending leads to ST.'
  )
ON CONFLICT (key) DO NOTHING;
