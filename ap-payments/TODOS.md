# AP Payments — TODOS

## ap_install_jobs.labor_cost is unreliable — reconcile or remove
- **What:** The `labor_cost` column on `ap_install_jobs` is computed during cron sync
  (`app/api/cron/sync/route.ts:254-327`) from gross-pay-items × hourly rate, with an
  appointment-window fallback and a trade-default rate when a tech's rate is missing.
  Owner flagged it as "half thought through" / not trustworthy.
- **Why:** It's a stored cost number that looks authoritative but isn't. The Adjusted Gross
  Margin feature (2026-06) deliberately ignores it (uses ServiceTitan labor cost instead) to
  avoid surfacing a wrong number. But the column still exists and may be read elsewhere (Labor
  tab), so the unreliable value can leak into other views.
- **Context:** Surfaced during the gross-margin office-hours + eng-review (design doc
  `~/.gstack/projects/n8dizzle-debrief-tools/jonathanchasse-main-design-20260625-110413.md`).
  Decide: (a) fix the calc (real per-tech rates, drop the trade-default fallback, handle
  multi-tech correctly), or (b) drop the column and rely on ServiceTitan labor cost everywhere.
  Check who reads `labor_cost` first (`grep -rn labor_cost ap-payments/`).
- **Depends on / blocked by:** None. Independent of the margin feature, but informed by it.
