-- Migration 012: drop the triple_win_enabled kill switch and related dead schema.
--
-- After PR1 pinned the kill switch to true and hid it from the admin UI, the
-- underlying schema kept carrying the baggage: a setting nobody can edit, a
-- legacy boolean column on ref_referrers that nothing reads, a one-time
-- announcement-email flag column that's no longer relevant now that all test
-- data is wiped, and a change-requests table that was provably dead at PR1
-- eng review. Clean it up so the next person reading this schema doesn't
-- wonder which knobs actually do anything.
--
-- Companion PR2 code deletion rips the 14 `if (tripleWinEnabled)` branches
-- and the announcement-email apparatus out of the app layer in the same
-- commit, so the schema + code land together.

-- ============================================================================
-- 1. Drop the setting row (its UI home is already gone)
-- ============================================================================

DELETE FROM ref_settings WHERE key = 'triple_win_enabled';

-- ============================================================================
-- 2. Drop legacy columns on ref_referrers
-- ============================================================================
-- triple_win_enabled: per-referrer opt-in from the pre-global-policy era.
-- Nothing reads it anymore; writers stamp it as a side effect of enroll
-- but that write path goes away in PR2 code.
--
-- triple_win_announcement_sent_at: tracked which existing referrers got the
-- one-time "Triple Win is now automatic" email. Moot now: transactional data
-- was wiped at PR1 (migration 010), and the announcement apparatus is being
-- deleted in PR2 anyway.

ALTER TABLE ref_referrers DROP COLUMN IF EXISTS triple_win_enabled;
ALTER TABLE ref_referrers DROP COLUMN IF EXISTS triple_win_announcement_sent_at;

-- ============================================================================
-- 3. Drop the dead ref_reward_config_change_requests table
-- ============================================================================
-- Table was created by migration 001 for a two-admin approval workflow on
-- reward-config edits. No code ever wrote to it or read from it — it was
-- dead on arrival. PR1 eng review confirmed this via grep. Outside voice
-- (Claude subagent) flagged leaving it in place as schema rot.

DROP TABLE IF EXISTS ref_reward_config_change_requests;

-- ============================================================================
-- What's intentionally NOT dropped
-- ============================================================================
-- ref_reward_configs.experiment_group, ref_reward_configs.traffic_allocation:
-- A/B testing infrastructure from the tiered-rewards era. Unused under the
-- flat program. Kept on the schema as "dead configurable surface" in case
-- we ever want install-tier bands (60-90 day revisit per the plan).
--
-- ref_reward_tiers.*: the 4-per-config structure still exists because
-- resolveTierForConversion() looks up tier by service_category. The
-- enforce_tier_identity trigger (migration 009) keeps all 4 rows identical
-- under the flat program. Collapsing to 1 tier is a separate future change.
