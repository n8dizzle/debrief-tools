# Install Tracker → Workflow Engine (design note)

Status: **AGREED, not yet built.** Chat-stage design as of 2026-07-08. Do not build
until Jon says go.

## The shift

The app is not *one* install pipeline — it's a **library of workflows**. Each project
runs the workflow that matches what was sold. Same tool, different "recipe" per deal.

Workflows (to start):
- **Full System** — the hard one, 7 stages. Build this first.
- **Partial System** — shorter (likely no permit, simpler equipment/inspection).
- **Warranty** — different entirely (part ordered → tech dispatched → closed).
- More as they surface.

## The classifier IS the router

The equipment classifier we validated already sorts every deal — so it feeds workflow
assignment:
- systems ≥ 1 → **Full System**
- components > 0, systems = 0 → **Partial**
- all sold estimates warranty-named → **Warranty**
- else → Other / not tracked

So `suggested_class` = *suggested workflow*. **Triage = confirm or override the workflow
assignment** (no longer just "install vs archive"). "Archive" returns to meaning
genuinely-not-tracked; partials/warranty route to their own workflows instead.

## Core model

- **Workflow** = top-level entity (name, order). Each owns its stage + sub-step template.
- **Template** = the editable map (today's `install_nodes`). It becomes the **Full System**
  template; each workflow gets its own tree (add `workflow_id` to nodes).
- **Deal** gets a `workflow_id` (classifier-suggested, triage-confirmed).
- **Per-deal sub-step status** (NEW store): deal × sub-step → done / by / at / note.
  Only manual sub-steps need storage; auto ones are computed.

## Sub-steps: auto vs manual

- **Auto** — wired to known ServiceTitan signals, tick themselves:
  | Sub-step | Signal |
  |---|---|
  | Contract signed | sold estimate exists |
  | Job created in ST | job # exists |
  | Scheduled | appointment set |
  | Installed | job completed |
  | Invoiced / paid | invoice exists / balance 0 |
- **Manual** — human checkbox: deposit/financing, handoff to coordinator, permit
  submitted/approved, equipment ordered/delivered/staged, inspection scheduled/passed,
  text the customer. **These manual gates are the entire reason the app exists.**
- **Stage status rolls up from its sub-steps** (all done → done; some → in progress; the
  stuck one → the early warning).

## UI

- Tabs become **one per workflow**: Needs Triage / Full System / Partial / Warranty /
  Archived.
- Deal detail: each stage expands to its sub-step checklist — auto ticks show the ST
  evidence (not clickable), manual ones are checkboxes (owner/manager only), stage dot
  rolls up.

## Build order

1. **Phase 1 — make "workflow" real.** Introduce the concept; today's map → Full System
   template; classifier suggests + triage assigns a workflow; tabs reflect workflows.
   Mostly a new assignment field + renaming; app barely changes visually.
2. **Phase 2 — per-deal sub-step tracking (the engine).** The status store, the deal-detail
   checklist (auto + manual), stage roll-up. Fix the deal-detail Systems/Components label
   bug in the same pass. This is where it becomes a workflow tool, not a viewer.
3. **Phase 3 — add Partial + Warranty workflows.** Stub templates; route those deals in
   instead of archiving.
4. **Phase 4 — automation (later).** Texts / notifications hanging off manual steps.

## Open decisions (defer until hit)

- **Template drift:** editing a workflow after deals are running it — do changes reach
  in-flight deals? (Lean: yes, live template, status keyed by sub-step id.)
- **Auto-vs-manual setting:** hardcode the known signals, or make it a per-sub-step toggle
  on the map? (Start hardcoded; make editable later if wanted.)

## Known bug to fix during Phase 2

`/deals/[projectId]` detail page still uses the pre-split mapping: header shows
"Systems N" but uses `equipment_unit_count` (= components), and `deriveDealStages` maps
system_count:=equipment_unit_count / component_count:=null → e.g. Larissa Kyer (gas full
system) shows "Systems 3" and "Systems / components: 3 / —" instead of 1 system / 3
components. The Deals *table* is correct; the detail page wasn't migrated. Also the
"counts come from ap-payments" note is stale (now our own classifier), and
getProjectEstimates/EstimatesBlock use raw `equipment_count`, inconsistent with the
classified popup.
