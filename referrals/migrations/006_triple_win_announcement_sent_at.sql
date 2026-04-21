-- Track which referrers received the one-time Triple Win announcement email.
-- Product context: when Triple Win flipped from per-referrer opt-in to a
-- global admin-controlled policy, existing referrers who hadn't picked a
-- charity lost nothing but were no longer being prompted to opt in. This
-- column supports a single batched email reaching out to those users so
-- their future referrals can trigger charity matches.
--
-- Idempotency: the batch endpoint filters out anyone with this set, so
-- accidentally running the send twice can't re-email the same person.

ALTER TABLE ref_referrers
  ADD COLUMN IF NOT EXISTS triple_win_announcement_sent_at TIMESTAMPTZ;
