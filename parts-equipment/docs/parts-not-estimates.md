# Track parts, not estimates — and follow them to cash

**Status:** proposal, nothing built
**Written:** 2026-08-07 (v2 — rewritten after Jon's challenge to the definition of "done")
**Numbers** were measured against live ServiceTitan and the production database on 2026-08-05/07.

---

## What changed in this version

v1 said a part was done when it reached the shop. Jon's push-back: **that's still the parts team's finish line, not the business's.** Nothing is done until the work is completed, the customer is invoiced, and the money is collected.

He's right, and it makes the rest simpler. There is no "done" stage owned by parts. There is one record that keeps flowing, and it ends at paid.

---

## The problem, in one job

Mary Moilan, job `188471543`. The Parts Coordinator says two of three parts are moving and one is on backorder. ServiceTitan holds:

```
EST 188609954  "Warranty System Controller, Thermostat"   $0
    INVOICED   CA-W-TSTAT      thermostat
    INVOICED   CHR
    INVOICED   CA-W-CBOARD     control board   <-- the backordered one

EST 188611878  "Warranty Furnace Control Board"           $0
    INVOICED   CA-W-CBOARD     <-- workaround, also swallowed
```

**The board shows this job as `done`.**

The workaround failed silently: the PC created that second estimate to represent "install the backordered board when it arrives," and it was invoiced at creation, so the app ignores it too. He built a signal the app swallows and had no way to know.

## Two root causes

### 1. The unit of work is wrong

One row per **estimate**; reality's unit is one **part**. A row holds one status, so the moment two parts diverge the board is lying about one of them.

| Unbilled parts on the estimate | Estimates |
|---:|---:|
| 1 | 70 |
| 2 | 24 |
| 3 | 9 |
| 4 | 4 |
| 5 | 3 |
| 6 | 2 |
| **12** | **2** |

**114 queue-worthy estimates hold 212 unbilled parts. 44 of them — 39% — have more than one and cannot be represented correctly today.**

### 2. Every "done" signal so far has been someone else's finish line

- ServiceTitan's `invoiceItemId` means *billed onto the job*. For warranty parts at $0 it fires at creation — before the part exists.
- "At the shop" means *parts is finished*. The customer still has a broken system and an unpaid invoice.

Both close a record while the work is live. That's the whole trust problem.

## The model

**One row per line item**, keyed on the ServiceTitan line-item `id` (verified stable, and every item carries `sku`, `qty`, `unitCost`, `invoiceItemId` alongside it).

**One pipeline, running to cash:**

```
needs order → ordered → inbound → at shop → installed → invoiced → paid
└──────────── parts team ───────────┘   └─ field ─┘   └─── office / AR ───┘
```

Nothing closes because a system said so. The record moves because a person did the work, or because money arrived.

**Ownership moves along the chain; visibility does not.** A part leaves the Parts Coordinator's queue at "at shop" — it stops being their problem — but the record stays alive and visible on the Master view until it's paid. That's the difference between *whose queue it's in* and *whether it's finished*.

## Where each stage's truth comes from

| Stage | Source | Set by |
|---|---|---|
| needs order → ordered | app | Parts Coordinator |
| inbound → at shop | app | Warehouse |
| installed | ServiceTitan job completion | read |
| invoiced | ServiceTitan invoice | read |
| paid | ServiceTitan payment | read |
| in collections, promise-to-pay, escalated | AR app (`ar_*`) | read |

### An important caveat about the AR app

The AR app is the right place to read **collections state**, but it is **not** a complete invoice ledger. Measured:

- `ar_invoices` holds **2,144** invoices spanning 2024-04 to 2026-08 — 163 unpaid, 1,981 paid.
- Of **630** parts rows with a job number, only **99** match an AR invoice.

That's too few to be a coverage gap in the join — the join works, `ar_invoices.job_number` lines up with `pe_orders.job` cleanly. It means AR holds a *subset*: the invoices collections cares about.

**So: read `invoiced` and `paid` from ServiceTitan, which is complete. Read collections status from the AR app, which is where that judgment lives.** Don't rebuild either.

## Decisions needed

### A. What the board displays

212 loose part-cards would be worse than 114 wrong ones.

**Recommendation:** one card per **job**, parts listed inside, card status driven by the worst part. Mary Moilan reads *"3 parts · 2 ordered · 1 backordered"* and expands.

### B. What each team sees

With rows living for months, no one should stare at the whole pipeline.

**Recommendation:** each board filters to the stages that team owns, plus a persistent "waiting on me" count. The Master view is the only place the full pipeline is visible. A Parts Coordinator sees ~27 rows, not 300.

### C. The rows that already exist

628 rows total · **77 open** · 620 distinct estimates · 8 created by hand with no estimate behind them.

| stage | open rows |
|---|---:|
| staged | 37 |
| needs order | 27 |
| inbound | 7 |
| ordered | 6 |

**Recommendation:** migrate only the 77 open rows; leave the 551 closed ones as historical records in their current shape. Each open row expands into one row per unbilled part, inheriting its current stage. The 8 manual rows carry over as single parts.

### D. What happens to the 37 rows sitting at "staged"

Under the new model these aren't finished — they're parts at the shop waiting to be installed.

**Recommendation:** they move to `at shop` and stay open, which will make the board look busier overnight. That's accurate, and worth warning the team about before it happens.

## Sequencing

Each step ships on its own and leaves the app working. The visible changes are late on purpose.

1. **Add the part fields** — line-item id, SKU, qty, unit cost — populated by the sync, not yet driving the screen. Nothing visibly changes.
2. **Verify the shape** over a few days of real syncs. Does every part get an id? Do re-syncs match instead of duplicating?
3. **Migrate the 77 open rows.** Dry run first, full before/after count.
4. **Switch the boards to grouped-by-job display**, with per-team stage filters. First visible change; needs team warning.
5. **Add `installed` and `invoiced`** read from ServiceTitan.
6. **Add `paid`, and surface AR collections status.** Retire every auto-close along the way.

## Risks

- **Duplicate rows on re-sync** if line-item ids prove unstable. Step 2 exists to catch that before migration.
- **Row count grows** roughly 1.9× on the queue. Fine at this scale — but the board must group, not list.
- **Rows now live for months.** Without per-team filtering (decision B) the boards become unusable. B is not optional.
- **Auto-close disappears entirely.** Work that used to vanish will sit until a person or a payment moves it. Expect the board to look worse before it looks right — and expect that to be the truth.
- **ServiceTitan invoice/payment reads are unverified.** The app already talks to ST for estimates; steps 5 and 6 assume invoices and payments are reachable the same way. Confirm before committing to those steps.

## Not in scope

- Retiring the Service and Install tabs — sequenced after the team boards exist.
- Removing the guessed subtype and owner — built, held on `fix/pe-drop-subtype-owner-guess` until routing and training are ready.
- Rebuilding anything AR already does. Read it.
- Slack notifications — deferred. An accountability layer on a workflow that isn't solid yet just teaches people to ignore Slack.

## How we know it worked

Mary Moilan's job shows **"2 of 3 parts ready, 1 backordered."** The Parts Coordinator never invents a phantom estimate to say so. And the record doesn't disappear when the part reaches the shelf — it stays alive, in someone's hands, until the invoice is paid.
