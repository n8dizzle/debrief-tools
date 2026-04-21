-- Track Tremendous-side order state separately from our internal reward status.
--
-- Our `status` column means "where is this reward in our business workflow"
-- (PENDING → APPROVED → ISSUED → DELIVERED). `tremendous_status` stores the
-- raw status string Tremendous returns so we can tell the difference between:
--
--   a) Order created, Tremendous auto-approved and executed it (our status = ISSUED)
--   b) Order created, Tremendous is gating on human amount-review approval
--      (our status = APPROVED, tremendous_status = 'pending_approval')
--   c) Tremendous declined the order after review
--      (our status = FAILED, tremendous_status = 'declined')
--
-- Values come from Tremendous's API literally. Known values include:
--   pending_approval, approved, executed, declined, failed, cancelled
-- We don't enforce an enum — Tremendous can add new values and we want to
-- preserve them for debugging even if we don't recognize them yet.

ALTER TABLE ref_rewards
  ADD COLUMN IF NOT EXISTS tremendous_status TEXT;
