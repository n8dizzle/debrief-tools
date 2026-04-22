# Simplify Referrals to Flat Triple-Win Program

_Status: planning — not started. Drafted 2026-04-22, revised post-eng-review 2026-04-22._

## Intent

Collapse the current 4-tier, service-category-differentiated reward config into a single flat program: **$50 referrer / $50 friend / $50 charity**, with an optional campaign label that drives promo banners across the 3 conversion pages. Preserve the "Triple Win" brand by making the three-way equation structurally unbreakable.

### Origin

Scott (founder) asked for a dead-simple "$50 triple win — referrer, friend, charity." Jon agreed on simplicity but wanted flexibility to adjust amounts independently and (eventually) add spending bands for large installs. Initial direction: launch flat, flex amounts via a monthly rhythm, add bands only after 60–90 days of data.

### The governing constraint

Never break the three-way equation. All three amounts must stay positive. Within that constraint, flex amounts freely. The "Triple Win" label on the product exists because of the equation — zero out any leg and the brand collapses.

## Eng-review outcome: split into 2 PRs

**PR1 (this plan):** Simplification only. New admin UI, campaign banner, copy audit, data migration, test-data wipe. Kill-switch (`triple_win_enabled`) stays alive in code but is hidden from `/admin/settings` and pinned to `true` in the DB so it's effectively non-functional. ~13 files.

**PR2 (follow-up, separate plan):** Kill-switch deletion. Rip `if (tripleWinEnabled)` branches from 14 files, delete announcement-email apparatus, drop dead columns/tables. ~25 files. Ships only after PR1 has canaried clean in prod for a few days.

Rationale: single-axis rollback. A bug in kill-switch removal shouldn't force reverting the simplification work and vice versa. PR1 is a product change; PR2 is code hygiene.

## PR1 reward model

```
current_program = {
  referrer_amount: 50,      // Tremendous gift card; writes tier.flat_reward_amount
  friend_amount:   50,      // "$50 off first service"; writes tier.referee_discount_amount + tier.referee_discount_label
  charity_amount:  50,      // Donation to chosen charity; writes tier.charity_match_flat (with charity_match_mode='FLAT')
  campaign_label:  null     // Writes ref_reward_configs.campaign_label
}
```

- Charity = dollar amount (not %/multiplier)
- `$0` hard-blocked on any of the three, enforced at **both** admin UI validator AND the Postgres RPC (defense in depth)
- Single program at a time; no "scheduled promos" entity — marketing rhythm is "admin edits the current program at start/end of month"
- No approval flow — direct edits, change log preserves history

## Migrations (PR1)

### Migration 009 — schema extensions
- `ALTER TABLE ref_reward_configs ADD COLUMN campaign_label TEXT` (nullable)
- `ALTER TABLE ref_reward_config_change_log ADD COLUMN change_type TEXT, ADD COLUMN summary_json JSONB` so the RPC can write a single row per save with a `{before, after, label_before, label_after}` snapshot
- `CREATE OR REPLACE FUNCTION update_active_program(p_referrer NUMERIC, p_friend NUMERIC, p_charity NUMERIC, p_label TEXT) RETURNS VOID` — single-tx RPC:
  - `RAISE EXCEPTION` if any amount < 1 (DB-layer $0 guardrail)
  - `UPDATE ref_reward_tiers SET flat_reward_amount = p_referrer, referee_discount_amount = p_friend, referee_discount_label = '$' || p_friend || ' off first service', charity_match_flat = p_charity, charity_match_mode = 'FLAT', min_invoice_total = 0, reward_mode = 'FLAT' WHERE reward_config_id = (active config id)` — all 4 tier rows in one statement
  - `UPDATE ref_reward_configs SET campaign_label = p_label WHERE is_active AND is_default`
  - `INSERT INTO ref_reward_config_change_log` with `change_type='active_program_update'` and a `summary_json` snapshot
- `CREATE OR REPLACE FUNCTION enforce_tier_identity() RETURNS TRIGGER` + trigger on `ref_reward_tiers` INSERT/UPDATE: for any tier whose config has siblings, the row's `{flat_reward_amount, referee_discount_amount, charity_match_flat}` must match siblings. Reject divergent writes. Prevents any future non-RPC writer from splitting the tiers.

### Migration 010 — data reset + seed new flat config
1. `TRUNCATE TABLE ref_webhook_events, ref_charity_donations, ref_rewards, ref_referrals, ref_referrers CASCADE` (transactional wipe per user confirmation that existing data is test data; `ref_charities`, `ref_settings`, charity-donation relationship preserved via CASCADE order)
2. `DELETE FROM ref_reward_tiers; DELETE FROM ref_reward_configs;` (outright delete, not deactivate — no in-flight data to protect)
3. `INSERT INTO ref_reward_configs` one row "Triple Win Flat 2026" with `is_default=true, is_active=true, traffic_allocation=100, campaign_label=NULL`
4. `INSERT INTO ref_reward_tiers` 4 rows (SERVICE_CALL / MAINTENANCE / REPLACEMENT / COMMERCIAL), all identical:
   - `reward_mode='FLAT'`, `flat_reward_amount=50`
   - `referee_discount_type='FLAT_DOLLAR_OFF'`, `referee_discount_amount=50`, `referee_discount_label='$50 off first service'`
   - `charity_match_mode='FLAT'`, `charity_match_flat=50`, `charity_match_floor=0`, `charity_match_cap=NULL`
   - `min_invoice_total=0`, `max_invoice_total=NULL`, `requires_admin_approval=false`
5. `UPDATE ref_settings SET value='true' WHERE key='triple_win_enabled'` (pin for PR1; PR2 drops the row)

**PR2 migration preview (not in this plan):**
- Migration 011 drops `triple_win_enabled` from `ref_settings`, drops `ref_referrers.triple_win_enabled` column, drops `ref_referrers.triple_win_announcement_sent_at` column, drops `ref_reward_config_change_requests` table (provably dead), optionally drops `ref_reward_configs.experiment_group` / `traffic_allocation` or marks them with a kill-date TODO. Rips all 14 `if (tripleWinEnabled)` branches + announcement-email apparatus.

## Admin UX: replace `/admin/config` (PR1)

Delete: `app/admin/config/page.tsx`, `app/admin/config/[id]/page.tsx`, `app/admin/config/[id]/EditConfig.tsx`, `app/admin/config/[id]/history/` (whole subdirectory).

Replace with a single page:

```
┌─ Current Program ─────────────────────────────┐
│                                               │
│   Referrer      Friend       Charity          │
│   [ $50 ]       [ $50 ]      [ $50 ]          │
│                                               │
│   Campaign label (optional)                   │
│   [ Double Your Charity — April ___________ ] │
│   When filled, shows a banner on /dashboard,  │
│   /refer/[code], and /enroll.                 │
│                                               │
│   [ Save changes ]                            │
│                                               │
└───────────────────────────────────────────────┘

┌─ Live preview ────────────────────────────────┐
│  /refer/[code] banner: "Double Your..."       │
│  /dashboard banner:     "..."                 │
│  FAQ copy:   "You get $50, they save $50..."  │
│  Terms copy: "Rewards are $50..."             │
└───────────────────────────────────────────────┘

┌─ Program history ─────────────────────────────┐
│  Apr 1: Jon bumped charity $50 → $100,        │
│         set label "Double Your Charity"       │
│  Mar 1: Initial launch $50/$50/$50            │
└───────────────────────────────────────────────┘
```

**Validation & save flow:**
- All three amounts required, must be ≥ $1 (client + DB)
- Confirm modal on save: "This takes effect immediately for all new referrals. Continue?"
- **Stale-lie guard:** if amounts return to baseline $50/$50/$50 AND `campaign_label` is non-null, the confirm modal becomes a 3-way choice — keep banner, clear banner, cancel save
- Save calls `update_active_program()` RPC (atomic). UI shows success/error toast.
- History section reads from `ref_reward_config_change_log` filtered to `change_type='active_program_update'`, ordered DESC.

Gated on `referrals.can_manage_config` (existing).

## Admin settings cleanup (PR1 — required for kill-switch pin)
- `app/admin/settings/SettingsEditor.tsx` — remove `triple_win_enabled` from `BOOLEAN_KEYS` and the rendered settings list
- `app/api/admin/settings/route.ts` — remove the `triple_win_enabled` validator entry (PATCHes to that key return 400)
- `app/admin/help/page.tsx` — remove the `triple_win_enabled` reference from the settings docs snippet

Effect: admin can't flip the kill-switch to false post-deploy. Migration 010 pinned it to true.

## Public site: banner + copy audit (PR1)

**New component** — `referrals/components/CampaignBanner.tsx`
- Server component; takes `label: string | null` prop (parent passes it from `getCurrentProgram()`)
- Renders a sticky banner only when label is non-empty; returns null otherwise
- Mounted above existing hero on `/dashboard`, `/refer/[code]`, `/enroll`

**Copy audit** — swap hardcoded fallbacks to dynamic reads from active config:

| File | Change |
|---|---|
| `app/page.tsx` | `FALLBACK_TIERS` → `getCurrentProgram()`; 3-amount display |
| `app/faq/page.tsx` | `earningsRangeCopy()` → "$50 referrer reward, $50 friend discount, $50 charity donation" |
| `app/triple-win/page.tsx` | `FALLBACK_TIERS` + `tierToCard()` → new 3-card hero (Referrer / Friend / Charity). Existing "currently disabled" branch stays until PR2. |
| `app/terms/page.tsx` | Replace hardcoded "$50 to $500+" prose with dynamic pull + keep "subject to change" disclosure |
| `app/refer/[code]/page.tsx` | Mount `CampaignBanner` above existing Triple Win hero |
| `app/dashboard/page.tsx` | Mount `CampaignBanner` |
| `app/enroll/page.tsx` | Mount `CampaignBanner` |

`lib/rewards/public-display.ts` — rename `getDefaultConfigTiers()` to `getCurrentProgram()` returning `{ referrer_amount, friend_amount, charity_amount, campaign_label }`. Update the 3 callers (`app/page`, `app/faq`, `app/triple-win`) to the new shape.

## Testing strategy (PR1)

Test infrastructure does not exist in the referrals app. Unit tests deferred to a follow-up TODO. PR1 relies on `/qa` for behavioral coverage. Test plan artifact written to `~/.gstack/projects/n8dizzle-debrief-tools/jonathanchasse-feat-ar-ux-and-bu-groups-eng-review-test-plan-20260422-165008.md` covering 47 QA paths and 6 regression flows (enroll, refer, dashboard, triple-win page, admin settings, webhook, welcome email). `/qa` consumes that file as primary input.

## Migration & rollback (PR1)

- No in-flight referrals (TRUNCATE wiped transactional tables).
- Rollback plan: revert commit. If already deployed, run a reversal migration that restores prior config shape. Since the only pre-existing data was test data, rollback is cosmetic.

## Out of scope (PR1, explicit)

- **Kill-switch deletion.** Pinned to true in PR1; fully removed in PR2.
- **Announcement-email apparatus removal** (`app/api/admin/triple-win/send-announcement/route.ts`, `lib/email/triple-win-announcement.ts`, `getTripleWinCounts()` panel, `ref_referrers.triple_win_announcement_sent_at` column). PR2.
- **Dead legacy column drops** (`ref_referrers.triple_win_enabled`, `ref_referrers.reward_preference` cleanup). PR2.
- **Dead table drop** (`ref_reward_config_change_requests`). PR2.
- **A/B infra cleanup** (`experiment_group`, `traffic_allocation` on `ref_reward_configs`). Revisit during PR2.
- **Install-tier bands.** Revisit after 60–90 days of flat data.
- **Per-charity differentiated amounts.** If ever, v2.
- **Scheduled-promo entity.** Intentionally not building — monthly rhythm handles it.
- **Tremendous webhook queue pause during TRUNCATE.** Operational checklist item for the deploy, not a code change (see Failure modes).

## What already exists (reused, not rebuilt)

- Tier-snapshot mechanic in `lib/referrals/snapshot.ts` (protects in-flight referrals). N/A for PR1 since we're wiping, but stays for future.
- `calculateReward()` + `calculateCharityMatch()` at `lib/rewards/calculate.ts:58-124` — already handle FLAT mode with floor/cap.
- `getBooleanSetting()` / `getStringSetting()` — existing settings read path.
- `ref_reward_config_change_log` table — powers history view.
- `referrals.can_manage_config` permission — admin page gate.

## Failure modes (PR1)

1. **TRUNCATE CASCADE hits real data.** Assumption: existing data is test data per user confirmation. Mitigation: take a point-in-time Supabase backup immediately before running migration 010. Checklist item, not code.
2. **Tremendous webhook orphans during TRUNCATE.** If any pending Tremendous sandbox callback arrives after TRUNCATE, `ref_webhook_events` is empty, the webhook handler logs a 404 and moves on. Low severity. Operational mitigation: pause the Tremendous webhook/queue for 5 min during migration 010 run.
3. **Admin edits `ref_reward_tiers` directly via SQL and diverges the 4 tiers.** Mitigated by the `enforce_tier_identity()` trigger in migration 009.
4. **RPC fails mid-save.** Entire transaction rolls back. UI shows error toast. No partial state. Covered.
5. **Campaign label stale-lie.** Admin reverts amounts but forgets to clear label → banner advertises a promo that isn't real. Mitigated by save-time 3-way confirm modal in admin UI.
6. **`getCurrentProgram()` returns null** (no active config found). Post-migration this shouldn't happen. Add a fallback: if null, render copy with seed values ($50/$50/$50) and log a Sentry error.

## Parallelization strategy (PR1)

Two lanes, minimal parallelism (PR1 is small enough that sequential is fine):

| Lane | Steps | Depends on |
|---|---|---|
| A | Migrations 009 + 010 | — |
| B | Admin UI + banner component + copy audit | Lane A |

Lane A must complete before Lane B starts (UI relies on new schema + RPC). Both lanes can be a single worktree since they don't conflict on files.

## Decisions log (from eng review)

| Decision | Answer |
|---|---|
| Data shape | `{ referrer, friend, charity, campaign_label? }` — three dollar amounts + optional label |
| Program versioning | One program at a time; edited in place, monthly rhythm |
| Charity as | Dollar amount writing `charity_match_flat` with `charity_match_mode='FLAT'` |
| Scheduled promos | Dropped — admin just edits the current program |
| Campaign framing | Optional `campaign_label` field on `ref_reward_configs`; banner on 3 conversion pages |
| Banner scope | `/refer/[code]`, `/dashboard`, `/enroll` only |
| $0 guardrail | Hard block at both UI validator AND Postgres RPC (`RAISE EXCEPTION` if any < 1) |
| Approval flow | Dropped; change log preserves history |
| Save atomicity | Supabase RPC `update_active_program()` in one transaction |
| Change log | One summary row per save via `change_type='active_program_update'` + `summary_json` |
| Tier-identity invariant | Postgres trigger `enforce_tier_identity()` prevents rogue divergence |
| Kill-switch | PR1: hide from admin UI, pin to true. PR2: delete. |
| Test posture | `/qa` only for PR1; vitest backfill as TODO |
| Data cleanup | TRUNCATE transactional tables (test data confirmed) |
| Old configs | DELETE entirely (not deactivate) — no in-flight data |
| Stale-lie guard | 3-way confirm modal when amounts return to baseline with label still set |
| PR split | 2 PRs — this is PR1 |

## Build sequence (PR1)

1. Migration 009 (schema + RPC + trigger + change_log cols)
2. Migration 010 (TRUNCATE + delete old configs + seed flat config + pin kill-switch to true)
3. New admin page (`/admin/config` rewrite) + admin settings cleanup
4. `CampaignBanner` component + mount on 3 conversion pages
5. Copy audit on marketing pages + `public-display.ts` rename
6. `/qa` + `/review` + `/ship` + `/land-and-deploy` + `/canary`

## Post-ship TODOs (will be logged via TODO section of this review)

1. Install vitest in referrals app + backfill unit tests for reward math, RPC, CampaignBanner
2. PR2: kill-switch deletion — 14 `if (tripleWinEnabled)` branches + announcement apparatus + dead columns/tables
3. Root `CLAUDE.md` Referrals section mentions `triple_win_enabled` as a first-live settings key — update after PR2 deletes it
4. Evaluate install-tier bands after 60–90 days of flat data in prod

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 8 issues, 0 critical gaps, scope expanded (+kill-switch removal, +PR split) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |
| Outside Voice | Claude subagent | Independent plan challenge | 1 | issues_found | 8 findings, 3 applied to plan, 3 moved to PR2 scope, 2 minor |

**UNRESOLVED:** 0
**VERDICT:** ENG CLEARED — ready to implement PR1. Design review optional (UI changes are limited to admin page + banner component — reasonable to skip). CEO review optional (scope locked via founder direction, not exploring broader strategy).
