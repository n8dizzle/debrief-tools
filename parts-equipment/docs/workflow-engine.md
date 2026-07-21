# Parts & Equipment — Configurable Workflow Engine (plan)

Status: **PLAN, chat-stage (2026-07-21). Not built.** Do not build until Jon says go.

Companion to `workflow.md` (the workflow we want). This is *how* to build it so stages
and tasks are **manager-editable in Settings — never hardcoded, no deploy per change.**
Vocabulary follows Standard's `standard/docs/workflow-engine.md`; this is the **operating**
counterpart to Standard's **observing** engine.

---

## v1 shape — eng-review decisions (2026-07-21)

*These decisions supersede the sections below where they conflict.*

1. **Slim v1.** Two tables only: `pe_wf_stages`, `pe_wf_steps`. **Boards stay a small code
   constant** (4 teams rarely change) — no `pe_wf_boards` table. **Defer `pe_wf_job_steps`**
   (per-step who/when) to a later phase; capture *values* already live on `pe_orders`.
2. **Don't rewrite the 3 boards into one generic renderer yet.** Keep the existing Parts/
   Warehouse/Dispatcher components; drive their **columns** from config incrementally
   (strangler, not big-bang). Converge later only if it earns it.
3. **Generic structure + flags now; config-driven transitions later.** Stages are fully
   configurable (add/rename/reorder) and carry **flags the code reads instead of names** —
   `is_terminal`, `is_parts_active`, `sort_order`, `advances_to`. The sync/boards refactor to
   ask *"does this stage have `is_parts_active`?"* not *"is stage === 'staged'"*. **Auto-
   transition rules (the sync's insert/reopen/booked/recency logic) stay in CODE, reading
   flags** — a config-driven transition/rules engine is a separate, later innovation token.
4. **`step.field` is allowlisted.** A step may only write to a curated set of capture columns
   (`order_num`, `supplier`, `eta`, `part_bo`, `parts_at_shop`, `call_booked`, …) — never
   protected columns (`status`, `order_type`, `id`, `stage`).
5. **Config validation.** A workflow must have >= 1 terminal stage and no cycles in
   `advances_to`; the Settings editor blocks saving a broken machine.

---

## Goal / non-goals

**Goal:** one generic engine where each team board is a **template** — ordered stages, each
with ordered steps — that a manager edits through a Settings UI. Boards render from the
template. Adding a stage or task is a settings edit.

**Non-goals:**
- Not rebuilding Standard's cross-app observation engine — Standard still *reads* us.
- Not owning scheduling logic — ServiceTitan books; we show `Scheduled` as context.
- Not a generic everything-tracker — deep on the parts/warehouse/dispatch flow only.

---

## The model (two levels)

```
Board (team lane)  ── has ordered ──▶  Stages (columns)  ── has ordered ──▶  Steps (tasks)
   Dispatcher / Parts / Warehouse / Service      Needs Order, Staged, …        auto or manual
```

- **Board** = a team's lane (Dispatcher, Parts, Warehouse, Service). Renders as its own tab.
- **Stage** = a column / position a job occupies. Drives board layout **and** the Master
  journey strip.
- **Step (task)** = a **typed data-capture point** on the record, not just a checkbox. Each
  step captures one of: **flag** (yes/no), **value** (text/number — an order #), **date**
  (ETA, scheduled), **choice** (dropdown — supplier), or a pure **action** (advance-only).
  Each is **auto** (filled from a signal) or **manual** (a person enters it — where
  accountability + SMS reminders hang). Steps accumulate on the record as it flows; a stage
  rolls up from its steps, and the stuck step is the early warning.

**The whole thing in one sentence:** one record (the sold-estimate-with-parts) flows across
team stages, each stage capturing typed data points onto it, converging on a schedule.

Every level is **data**, editable in Settings. Code renders whatever the template says.

---

## Schema (new `pe_wf_*` tables; `pe_orders` stays the master)

```
pe_wf_boards      id · key · name · sort_order · accent · active
pe_wf_stages      id · board_id → boards · key · label · sort_order · is_terminal · color
pe_wf_steps       id · stage_id → stages · key · label · sort_order
                     · data_type ('flag'|'value'|'date'|'choice'|'action')
                     · field (which pe_orders column this writes, e.g. 'order_num','eta',
                              'supplier','parts_at_shop','call_booked'; null for pure action)
                     · options (choice only: dropdown list, or a source like 'suppliers')
                     · kind ('auto'|'manual')
                     · signal (auto only: 'sold_estimate'|'job_created'|'scheduled'
                               |'order_num_entered'|'parts_received'|'staged'|'job_completed'|…)
                     · action_label (button text, e.g. "Picked up → At Shop")
pe_wf_job_steps   job_id → pe_orders · step_id → steps · done · done_by · done_at · note
                     (tracks MANUAL step completion + who/when; the captured VALUE itself
                      lands on the pe_orders column named by step.field — one source of truth,
                      no duplicate data. auto steps are computed live from signals)
```

- `pe_orders` gains: `board_id` (which lane) and keeps `stage` (now a template stage key,
  not a hardcoded enum). Job status stays ServiceTitan-aligned (`Sold/Scheduled/Completed/
  Canceled`) and is **never** what moves a card — the stage does.
- Auto-step signals map to existing evidence: sold estimate exists, `order_num` entered,
  warehouse "received"/"staged", ST job scheduled/completed. (Same auto table as Standard.)

### The data points already exist — the engine just makes them configurable steps

Today's `pe_orders` columns *are* the capture points; the engine turns each into a typed,
stage-assignable step instead of a hardcoded field:

| Capture point | Column | data_type | typical kind |
|---|---|---|---|
| Order number | `order_num` | value | manual |
| Supplier | `supplier` | choice (`suppliers`) | manual |
| Ship-to-shop vs pickup | `location` | choice | manual |
| Backordered? | `part_bo` / `blocked` | flag | manual |
| ETA | `eta` | date | manual |
| Parts at shop | `parts_at_shop` | flag | auto (warehouse "staged") |
| Scheduled | `call_booked` / `sched_date` | flag / date | auto (ST appointment) |
| Job completed | `status` | flag | auto (ST `Completed`) |

No new data model for the *values* — they stay on the one `pe_orders` record. The `pe_wf_*`
tables only add the **template** (which steps, where, what type) and **manual completion
metadata** (who/when).

---

## How the boards render (dynamic)

A board component becomes generic: given a `board_id`, load its stages → render a column per
stage; render each card's steps (auto ticks show evidence, manual steps are buttons/checkboxes
scoped by permission). "Move it forward" = completing a stage's steps (or its advance action)
moves the job to the next stage. **Today's three hardcoded boards collapse into one
`<WorkflowBoard boardId>` component.**

Master view reads the same templates to draw the journey strip — no separate stage list to
keep in sync.

---

## Settings UI (the payoff)

New Settings sub-tab **"Workflows"** (the app already has registry-driven, DB-backed settings
— Install Teams, Suppliers — so this follows an established pattern):

- Pick a board → see its stages (drag to reorder, rename, add, mark terminal).
- Pick a stage → see its steps (add/reorder/rename; set auto+signal or manual+button label).
- Manager-only; writes to `pe_wf_*`; boards reflect it immediately.

---

## Build order (phased — each phase ships, low blast radius)

1. **Schema + seed.** Create `pe_wf_*`; seed today's Dispatcher/Parts/Warehouse stages as
   template rows. Nothing visible changes yet.
2. **Boards render from templates.** Replace the three hardcoded board components with one
   generic `WorkflowBoard` reading the template. Same stages, now data-driven. Master reads
   templates too.
3. **Settings → Workflows editor.** Managers add/reorder/rename stages + steps. This is the
   "no code per change" moment.
4. **Per-step status (the engine).** `pe_wf_job_steps` + card checklists (auto ticks + manual
   checkboxes), stage roll-up, gamified throughput. Master shows step-level jams.
5. **Automation hooks (later).** SMS/Slack off manual steps — e.g. the morning "pick up your
   part" text — via the existing Quo + notifications engine.

Build behind the **sandbox schema** first (already stood up); promote to `public` when solid.

---

## Testing (v1 — non-negotiable, given the sync is fragile)

The risky change is refactoring the sync from stage-**names** to stage-**flags**. Tonight's
booked-vs-completed incident proved `queue-sync` is easy to break. So:

- **Regression tests on `buildQueuePlan`** — same inputs, same insert/reopen/schedule outputs
  before and after the flag refactor. This is a **CRITICAL** regression guard, not optional.
- **`isPartsActive` / flag reads** — unit tests: unknown/missing flag defaults to *safe*
  (treat as active + non-terminal, so nothing silently falls off a board).
- **Config validation** — tests that a workflow with no terminal stage, or a cycle in
  `advances_to`, is rejected by the editor.
- **`step.field` allowlist** — a step pointed at a protected column (`status`, `stage`) is
  rejected.

## Open decisions

- **"Both teams" routing — RESOLVED (recommended):** boards are **filtered views**, not
  explicit assignments. A board declares which jobs it shows (by `order_type` / flags); a
  job appears on any board whose filter it matches. "Both" is then automatic — no `board_id`
  on the job, no join table, no double-row. Cleanest fit for slim v1.
- **Template drift:** edits reach in-flight jobs (live template; nothing keyed by name).
- **Config-driven transitions:** deferred (separate innovation token — see v1 decision #3).
- **Gamification data:** deferred with `pe_wf_job_steps` — what's scored (throughput,
  time-in-stage, streaks) decided when that phase lands.
- **Engine home — RESOLVED:** Orders owns this operating engine; Standard keeps observing.
  Shared vocabulary, not shared code.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | scope→slim v1; stages generic-via-flags, transitions stay coded; field allowlist; routing = filtered views; sync-refactor regression tests required |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — slim v1 agreed, build order below the v1-shape section.
