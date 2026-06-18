-- Track the Tremendous gift-card order issued to the referred friend
-- when an admin manually marks a job complete from the admin panel.
ALTER TABLE ref_referrals
  ADD COLUMN IF NOT EXISTS friend_reward_order_id   TEXT,
  ADD COLUMN IF NOT EXISTS friend_reward_amount      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS friend_reward_issued_at   TIMESTAMPTZ;
