# Track parts, not estimates

**Status:** proposal, nothing built
**Written:** 2026-08-07
**Numbers in here** were measured against live ServiceTitan and production data on 2026-08-05/07, not estimated.

---

## The problem, in one job

Mary Moilan, job `188471543`. The Parts Coordinator says two of three parts are ordered and moving, one is on backorder. Here is what ServiceTitan holds:

```
EST 188609954  "Warranty System Controller, Thermostat"  $0
    INVOICED   CA-W-TSTAT      thermostat
    INVOICED   CHR
    INVOICED   CA-W-CBOARD     control board   <-- the backordered one

EST 188611878  "Warranty Furnace Control Board"  $0
    INVOICED   CA-W-CBOARD     <-- second estimate, created as a workaround
```

**The board shows this job as `done`.**

Worse, the workaround failed silently. The PC created that second estimate specifically to represent "install the backordered board when it arrives." It was invoiced the instant it was created, so the app ignores it too. He built a signal the app swallows, and had no way to know.

This single job is the whole trust problem in miniature: the board is confidently wrong, and the person closest to the work can't correct it.

## Two root causes

### 1. The unit of work is wrong

The app stores **one row per estimate**. Reality's unit is **one part**. A row holds exactly one `stage`, so the moment two parts on an estimate diverge, the board is lying about at least one of them.

This is not an edge case:

| Unbilled parts on the estimate | Estimates |
|---:|---:|
| 1 | 70 |
| 2 | 24 |
| 3 | 9 |
| 4 | 4 |
| 5 | 3 |
| 6 | 2 |
| **12** | **2** |

**114 estimates are queue-worthy right now, holding 212 unbilled parts. 44 of them — 39% — have more than one part and therefore cannot be represented correctly today.** Two of them have twelve parts sharing a single status.

### 2. "Invoiced" is being used to mean "done," and it doesn't

`invoiceItemId` means *billed onto the job*. It says nothing about whether the physical part exists. For warranty parts at $0 it gets set at creation — so the app's only completion signal fires the moment work *starts*.

That is why Mary Moilan's job reads `done` while a board sits on backorder at a supplier.

## What changes

**One row per line item.** The sync reads each estimate's items and creates a row per part that still needs ordering, keyed on the ServiceTitan line-item ID.

This is feasible with no guessing. Every line item already carries what we need:

```
id, sku, description, qty, unitRate, unitCost, total,
invoiceItemId, itemGroupName, createdOn, modifiedOn
```

`id` is stable, so rows can be matched on re-sync without string-matching descriptions.

**The parts flow owns its own states.** Stop inheriting "done" from ServiceTitan billing. The existing stages already describe the real journey — `needs_order → ordered → inbound → staged` — and `staged` (physically at the shop) is the honest completion signal. ServiceTitan goes back to being the billing record instead of doubling as a status field.

## Three decisions needed before building

### A. What the board displays

212 loose part-cards would be worse than 114 wrong ones.

**Recommendation:** one card per **job**, parts listed inside it, card status driven by the worst part. Mary Moilan reads *"3 parts · 2 ordered · 1 backordered"* and expands to show which. The Parts Coordinator still works a job at a time; they just stop losing the detail.

### B. What "done" means

**Recommendation:** a part is done when it is physically at the shop (`staged`), set by a human — Warehouse receiving it. Not when ServiceTitan bills it.

Consequence worth naming: the board will no longer close things by itself. That is the point. Every current auto-close we examined was wrong.

### C. The existing rows

628 rows total, **77 open**, 620 distinct estimates, 8 created by hand with no estimate behind them.

Open rows by stage today:

| stage | rows |
|---|---:|
| staged | 37 |
| needs_order | 27 |
| inbound | 7 |
| ordered | 6 |

**Recommendation:** migrate only the 77 open rows; leave the closed 551 as historical records in their current shape. Each open row expands into one row per unbilled part on its estimate, inheriting the current stage. The 8 manual rows have no estimate to expand and carry over as single parts.

## Suggested sequencing

Each step is shippable on its own and leaves the app working.

1. **Add the part fields alongside what exists** — line-item ID, SKU, qty, unit cost — populated by the sync but not yet driving the UI. Nothing visibly changes; the data starts arriving.
2. **Verify the shape** against real syncs for a few days. Does every part get an ID? Do re-syncs match correctly rather than duplicating?
3. **Migrate the 77 open rows**, with a dry run first and a full before/after count.
4. **Switch the boards to grouped-by-job display.** This is the visible change and the one needing team warning.
5. **Retire `invoiced` as the completion signal**, replacing it with `staged`. Do this last — it changes what closes and what doesn't.

## Risks

- **Duplicate rows on re-sync** if line-item IDs turn out unstable in practice. Step 2 exists to catch this before any migration.
- **Row count growth** — roughly 1.9× on the queue. Fine at this scale; worth remembering the board must group, not list.
- **Auto-close stops.** Things that used to disappear will now sit until a person moves them. Expect the board to look busier before it looks better, and expect that to be correct.
- **This does not fix the `order_type` guess.** That dies with the Service/Install tabs, separately.

## Explicitly not in scope

- Retiring the Service and Install tabs (separate, sequenced after the team boards exist)
- The `subtype`/`owner` guess removal (already built, held on `fix/pe-drop-subtype-owner-guess` pending training)
- Slack notifications (deferred — an accountability layer on a workflow that isn't solid yet just teaches people to ignore Slack)

## The test of whether this worked

Mary Moilan's job shows **"2 of 3 parts ready, 1 backordered,"** the Parts Coordinator never invents a phantom estimate to express it, and nobody has to ask why the board says done.
