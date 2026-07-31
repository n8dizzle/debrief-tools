# Career Ladders — config-driven progression engine

Status: **PLAN / for review** · Owner: Jon · Drafted 2026-07-31

## 1. Goal

Turn the one hardcoded HVAC Install ladder into a **manager-controlled, multi-role career-ladder engine**. Any manager can create and fully shape a ladder — levels, wage tiers, skill buckets, checkboxes, and promotion gates — with no involvement from HR or the tech team.

The bet (Jon's): the bottleneck to getting a ladder *correct* is how fast a wrong bucket or gate can be fixed. Full manager autonomy drops that from days (route through eng) to minutes (edit it live). Genericness is not a post-validation nicety — it is the thing that makes validation fast. We validate the *promotion process* on real ladders, expecting to learn as managers bend the model to reality.

## 2. Two real ladders the model must fit

Designing against both HVAC Install and the Service "2026 Technician Roadmap" already killed three assumptions baked into the current HVAC code:

| | HVAC Install | Service Technician |
|---|---|---|
| Buckets | Skills & Knowledge · Responsibilities · Equipment | Technical · Professional · Cultural (+ Leadership at L5) |
| Wage tiers | Multiple per level ($18→$21 in Apprentice) | None — assessed at the level |
| Gates | Skill/count (50 installs, CSAT %) | Timeframe (0–12mo…) + requirements list |
| Levels | 5 | 5 |

Implications:
1. **Buckets are manager-defined** — names *and* count vary per ladder, and can vary by level (Leadership appears only at Service L5).
2. **Wage tiers are optional** — Install assesses at the wage step; Service assesses at the level.
3. **Gates are free-form** — text + optional timeframe, not a fixed skill checklist.

Not in scope of the ladder itself: the Service doc's job description (duties, qualifications, physical demands). That is role-reference content, not assessable progression. Possible later "role overview" blurb; kept out of the checkable model so "item" stays unambiguous.

## 3. Concept model

```
Ladder                       e.g. "HVAC Install", "Service Technician"
 └─ Level                    e.g. "Apprentice", "Level 1: Entry"   (ordered; has gate + timeframe)
     └─ Tier (1+)            a wage/assessable step within a level  (pay optional)
         └─ Item             a checkbox, filed under a Bucket
 └─ Bucket (per ladder)      manager-defined category ("Skills & Knowledge", "Cultural")
```

- A **level with no wage breakdown** (Service) auto-gets a single default tier — the manager never sees "tiers" unless they *want* wage sub-steps (Install).
- **Items** attach to a `(tier, bucket)` pair. A bucket with no items at a given tier simply renders empty / hidden — this is how Service's Leadership bucket can exist only at L5.
- **Pay** is optional metadata on a tier: `$`, `%`, or blank.
- **Assessment mechanics stay engineered** (managers control content, not mechanics): the 3-state checkoff (not started → in progress → verified), the deficiency math, and auth do not change.

## 4. Data model

New tables (all `hr_*`, public schema):

```sql
hr_ladders
  id uuid pk default gen_random_uuid()
  name text not null
  description text
  st_business_units text[]         -- ap_technicians.business_unit_name values that populate the roster
  is_active boolean default true
  sort_order int default 0
  created_at/updated_at timestamptz, created_by uuid

hr_ladder_levels
  id uuid pk
  ladder_id uuid fk -> hr_ladders on delete cascade
  name text not null
  subtitle text
  gate_note text                   -- promotion gate to the next level
  timeframe text                   -- optional, e.g. "1–4 years"
  sort_order int not null

hr_ladder_tiers
  id uuid pk
  level_id uuid fk -> hr_ladder_levels on delete cascade
  pay_label text                   -- "$18 / hr", "4% (≈ $600/$15K)", or null
  pay_value numeric                -- optional, for auto-placement hints
  pay_kind text                    -- 'hourly' | 'commission' | 'other' | null
  gate_note text                   -- optional per-tier note (Install graduation lines)
  is_default boolean default false -- the auto-created single tier for level-only ladders
  sort_order int not null

hr_ladder_buckets
  id uuid pk
  ladder_id uuid fk -> hr_ladders on delete cascade
  name text not null
  is_gate boolean default false    -- e.g. "Equipment cleared" behaves as a gate
  sort_order int not null

hr_ladder_items
  id uuid pk
  tier_id uuid fk -> hr_ladder_tiers on delete cascade
  bucket_id uuid fk -> hr_ladder_buckets on delete cascade
  text text not null
  is_gate boolean default false
  sort_order int not null
```

Per-technician state (evolve the existing two tables):

```sql
hr_tech_ladder          -- placement
  st_technician_id bigint  (pk stays, but see multi-ladder note)
  ladder_id uuid           -- NEW: which ladder this tech is assessed on
  current_tier_id uuid     -- renamed from current_rung_id
  hire_date date, notes text, updated_at, updated_by

hr_tech_skill_status    -- checkoffs
  st_technician_id bigint
  item_id uuid             -- was skill_id text (string ladder id) → now the DB item id
  status text  (not_started|in_progress|verified)
  note text, verified_by uuid, verified_at, updated_at
  unique (st_technician_id, item_id)
```

Cascade deletes mean removing a level/tier/bucket cleans up its items; **but** we do NOT want a bucket rename or reorder to wipe checkoffs — only true deletes cascade. Editor deletes prompt when a target has recorded checkoffs (see §6).

## 5. Migration of the existing HVAC ladder

1. One-time seed reads `lib/ladder.ts` and writes the HVAC Install ladder into the new tables (1 ladder, 5 levels, 15 tiers, 3 buckets, ~90 items).
2. Map every existing `hr_tech_skill_status.skill_id` (string, e.g. `apprentice_18:skill:0`) to the new `item_id` (uuid) via `(tier, bucket, index)`. Only one checkoff row exists today, so risk is near zero — but the mapping is written generally.
3. Set `hr_ladders.st_business_units = {'HVAC - Install'}` (de-hardcodes the roster filter currently living in `/api/techs`).
4. `lib/ladder.ts` becomes seed-only reference and is removed from the runtime read path.

## 6. Manager editor (the core new build)

New sidebar area **"Career Ladders"** (manager-gated). Screens:

- **Ladders list** — cards; create / duplicate / archive. Duplicate is the fast path to a new role ("clone HVAC Install → edit into Plumbing").
- **Ladder editor** (one page, inline-editable, autosave):
  - Header: name, description, **roster source** (multi-select of ST business units → who populates this ladder).
  - **Buckets**: add / rename / reorder / delete the ladder's categories.
  - **Levels**: add / reorder; each has subtitle, gate note, timeframe.
    - **Tiers** within a level: add wage steps (pay label + value + kind) or leave the single default tier for level-only ladders.
      - **Items**: under each tier, grouped by bucket, add / edit / reorder / delete checkboxes; mark `is_gate`.
  - Drag-reorder everywhere; delete guarded when checkoffs exist ("3 techs have progress on this item — delete anyway?").

De-hardcoded, fully self-serve. No HR/tech involvement to change content.

## 7. Assessment view (evolve current `/ladder`)

- A **ladder selector** (Install / Service / CX / …).
- Renders **dynamically from the DB** — buckets come from config, not the hardcoded `CATEGORY_LABEL`. Everything else (team heatmap, per-tech skill map, climb %, "gaps at current level" + "to reach next tier") stays.
- Auto-placement hint still works where `pay_value` + hourly rate exist; ladders without wage tiers just rely on explicit placement.

## 8. Permissions

- **Assess / view**: `hr_hub.can_access` (owner bypass) — unchanged.
- **Edit ladders**: `hr_hub.can_manage_templates` (owner bypass). Reuse the existing key; the label already reads "Manage templates." (Could add a dedicated `can_manage_ladders` later if we want finer control.)
- Wage labels are comp-adjacent; visibility follows `can_access`, same as today's `hourly_rate`.

## 9. Build slices

- **Slice 1 — engine + parity.** New schema + migration/seed of HVAC Install + read APIs; assessment view reads dynamically from DB with a ladder selector. Net user-visible change: nothing regresses; HVAC Install looks identical, now DB-backed. *Proves the model end-to-end.*
- **Slice 2 — manager editor.** Full CRUD on ladders/levels/tiers/buckets/items + roster source. *Delivers the autonomy.*
- **Slice 3 — dogfood Service + CX.** Build the Service "2026 Roadmap" ladder *through the editor* (not code). This is the real validation: if the editor can express Service (4 buckets, no wage tiers, timeframe gates) without an eng change, the model is generic. Then CX.
- **Deferred** (post-validation): technician self-view via SMS magic link (reuse training.christmasair.com pattern), auto-lit gates from ServiceTitan metrics, Gusto pay-rate auto-placement.

## 10. Open questions / gaps — RESOLVED 2026-07-31

1. **Roster / multi-ladder** → **DECIDED: one tech per ladder for v1.** `hr_tech_ladder` keeps its single-ladder PK; roster populated by the ladder's `st_business_units` filter. Revisit composite key only if a real hybrid role appears.
2. **Promotion history** → **yes** (accepted default). Add `hr_tech_ladder_events` (tech, from_tier, to_tier, by, at) — feeds the "is the process working" learnings.
3. **Gate structure** → free text + timeframe for now; structured/measured gates wait for the ServiceTitan phase.
4. **Buckets** → per-ladder with empty-at-tier hiding (covers Service's L5-only Leadership bucket). Accepted.
5. **Wage visibility** → follows `can_access` (same as today's `hourly_rate`). Accepted; revisit if pay needs separate gating.

## 11. What this explicitly is NOT (guardrails)

Managers control **content** (ladders, levels, tiers, buckets, items, wages, gates, roster source). They do **not** control **mechanics** (the 3-state assessment model, deficiency math, auth). That line keeps "full autonomy" from sprawling into an unshippable meta-tool.
