# Build brief: Gusto ↔ ServiceTitan people reconciliation (corrected)

> **Provenance.** This is a revision of an earlier brief. The design thinking in that
> document is good and mostly survives intact. What changed is the factual model of our two
> systems: several assumptions in the original are not true of ServiceTitan as we actually
> read it, and one conflicts with a standing instruction. Corrections are marked
> **[CORRECTED]** with the evidence, so you can check them rather than take them on faith.
>
> **Some of this already exists.** Branch `feat/hr-people-explorer`, commits `2dbbef3` and
> `f930aac`, worktree `../debrief-tools-hr`. Read §11 before building anything — four of the
> six patterns have a working first version and this is a redesign plus an engine upgrade,
> not a greenfield build.
>
> Where this brief and the repo's conventions disagree, follow the repo.

---

## 1. Context

Two systems hold the same people and drift apart:

- **Gusto** — payroll and HR. 133 records: 120 employees (65 active) + 13 contractors (10 active).
- **ServiceTitan** — field operations. 223 records in `pr_employees` (91 active), 62 in `ap_technicians`.

Drift shows up as name spellings, business-unit vs department disagreements, someone active
in one system and terminated in the other, and records that exist in only one place. Today
it's caught by eye, inconsistently.

Stack: Next.js App Router, TypeScript, Tailwind, Supabase. Theme is portal-controlled
light/dark via the `ca_theme` cookie — use the existing CSS variables (`--bg-secondary`,
`--text-primary`, `--border-subtle`, …), not a new token set. See §5.

---

## 2. Source of truth **[CORRECTED — this is the biggest change]**

The original brief assigned job title, department, and display name to ServiceTitan. That
cannot work, because **ServiceTitan has no such fields.**

Our ST sync reads exactly four things per person (`payroll-tracker/app/api/cron/sync/route.ts:57-96`,
confirmed against the live API 2026-08-03):

```
id · name · businessUnitId · active
```

That is the entire ServiceTitan surface for a person. No title, no department, no pay, no
hire date, no email.

| Field | Owner | Notes |
|---|---|---|
| Legal name, preferred name | **Gusto** | ST has a single free-text `name` |
| Job title | **Gusto only** | ST has no field. Not comparable, not resolvable. |
| Department | **Gusto** | ST's nearest analogue is business unit, a coarser different thing |
| Employment status, hire/term date | **Gusto** | ST has only a boolean `active` |
| Worker type (W-2 / 1099) | **Gusto** | ST has no concept of it |
| ST technician/employee id, business unit, dispatchability | **ServiceTitan** | operational identity |
| App permissions | **Portal** (`portal_users`) | not part of this reconciliation |

Jon, explicitly: *"Gusto is our golden source of HR and employee data."*

**Design consequence.** For fields Gusto owns and ST lacks, the UI must render "no field in
ServiceTitan" — **not** a mismatch. Marking ~65 people as disagreeing on title, when there
is no shelf in ST to put a title on, manufactures unfixable work. Keep the owner lookup so
it's tunable, but the useful states are `gusto_owns` / `st_owns` / `st_has_no_field`.

## 2a. Pay is out of scope **[CORRECTED — hard requirement]**

The original made `payRate` a headline `critical` mismatch. Remove it entirely.

1. ServiceTitan has no pay field. `ap_technicians.hourly_rate` is hand-typed in AP Payments
   (`ap-payments/app/api/technicians/[id]/route.ts:25`) and is NULL for 35 of 48 active techs.
   It was never ST data, so "ST vs Gusto pay" compares a Gusto value against a manual guess.
2. **Jon instructed on 2026-08-03: "remove wages immediately."** Compensation was stripped
   from the UI, the API, and the database, including the full compensation history, garnishments,
   PTO balances, and DOB embedded in the raw Gusto payload. `hr_gusto_snapshot` has no pay
   columns and 0 rows containing any pay trace.

Do not reintroduce pay comparison, pay display, or pay storage. If pay reconciliation is
ever wanted it's a separate, deliberate decision with its own permission model.

---

## 3. Data model **[CORRECTED — two ServiceTitan id namespaces]**

The original had one `externalId` per system. ServiceTitan has **two independent id spaces**
and the same human legitimately holds one of each, with different numbers. A single id per
system collides or silently drops an identity.

Real example — Colton Hill:

```
ap_technicians   tech_id 178117016   active
pr_employees     emp_id  136976205   role=Admin, inactive
```

Matt Mims holds **three** ST records: emp `136714622` (FieldManager, inactive), emp
`136722691` (Technician, active), and emp `137227159` under the name `Matt Mims (Office)`
(Admin, active). Scott Clark, Jordan Woods, and Ruben Vidal are the same shape.

```ts
type SystemId = 'gusto' | 'st_employee' | 'st_technician';

interface RawPerson {
  system: SystemId;
  externalId: string;
  // Gusto only
  firstName?: string | null;
  lastName?: string | null;
  preferredFirstName?: string | null;
  businessName?: string | null;   // contractors are entities, not humans
  department?: string | null;
  title?: string | null;
  workerKind?: 'employee' | 'contractor';
  hireDate?: string | null;
  terminationDate?: string | null;
  email?: string | null;          // Gusto and ap_contractors ONLY — never ST
  // ServiceTitan only
  name?: string | null;           // single free-text field
  businessUnitName?: string | null;
  stRole?: string | null;         // NOTE: see §3a — not ST data
  // both
  isActive: boolean;
}

type FieldKey = 'name' | 'department' | 'status';   // the ONLY comparable fields
type Severity = 'ok' | 'warning' | 'serious' | 'critical';
type Comparison = 'match' | 'differs' | 'absent_in_st' | 'no_field_in_st' | 'unmapped';
```

Note `FieldKey` has three members, not five. Title has no ST counterpart; pay is out.

### 3a. `pr_employees.role` is not ServiceTitan data **[CORRECTED]**

`payroll-tracker/app/api/cron/sync/route.ts:79` hardcodes `role: 'Technician'` for everyone
in ST's technician list. So a `role` of `Technician` means only "this record came from the
technicians endpoint." Do not treat it as a job title or reconcile against it.

---

## 4. Matching engine

Pure functions in `lib/reconcile/`, no UI imports, unit tested. An initial version exists at
`hr-hub/lib/people-match.ts` — extend it rather than starting over. It currently has
`normalizeName`, `nameKey`, `gustoNameForms`, `matchToGusto`, `nameDiffersFromGusto`, and
`ST_BU_TO_GUSTO_DEPT`, with **no tests**. Tests are the highest-value thing to add.

### 4a. Linking **[CORRECTED — email is unavailable on the ST side]**

The original led with exact email match. **Our ST mirrors carry no email and no phone.**
Email exists only on Gusto and `ap_contractors`, which is exactly why contractors reconcile
well and employees don't:

| | matched on email | matched on name |
|---|---|---|
| `ap_contractors` ↔ Gusto contractors | **8 of 10** | 3 of 10 |
| ST employees ↔ Gusto employees | **0 — no email in ST** | name only |

So linking is **name-only on the ST side today**. Passes, in order:

1. **Normalized exact.** Lowercase, strip parentheticals (`Matt Mims (Office)`), strip
   punctuation (`Christina Lewis.`), collapse whitespace. Match on first + last token.
2. **Preferred-name variants.** Gusto carries both legal and preferred; index every form.
   Real cases: Nehemie/**Hemi** Petties, Oscar/**Ozzy** Cordova, Kathryn/**Kat** Tsakonas,
   Eliud/**Eli** Hernandez, Benjamin/**Ben** Barnhill, Christopher/**Lance** Morton.
3. **Nickname / prefix.** Same last name plus a shared first-name prefix. The existing rule
   is a crude 3-character prefix — **replace it with a confidence score** (see below).
4. **Business-name fuzzy** for contractors: `R.V. & Sons` ↔ `Roger [RV & Sons]`.
5. Unmatched on either side → orphan.

**Confidence scoring (adopt from the original — it's better than what exists).** Emit a
0..1 score plus the signals that produced it, so a human can see *why*. Available signals,
being honest about what we have:

| Signal | Weight | Available? |
|---|---|---|
| Normalized exact name | strong | yes |
| Gusto preferred-name form matches | strong | yes |
| Last name exact + first-name nickname | medium | yes |
| Last-name Levenshtein similarity | scaled | yes |
| Business unit ↔ department consistent | medium | yes, where mapped |
| Shared email | strong | **contractors only** |
| Shared phone | strong | **not synced — see §10** |
| Shared hire date | strong | **not in ST** |

Thresholds `>= 0.9` auto-link, `0.6–0.9` suggest-and-confirm, `< 0.6` orphan. Keep weights
and thresholds in one config object.

**Be honest in the UI about a thin signal set.** With name as the only cross-system key,
0.75 means "the names are similar," not "probably the same person." The reasons list is what
makes that legible, so it is not optional garnish.

### 4b. Field comparison

Only three fields are comparable. For each, `Comparison` not just match/differ:

- **`name`** — normalized compare. Differ → `warning`. Produce a character-level diff for
  display (adopt from the original; the current UI just shows both strings).
- **`department`** — Gusto department vs ST business unit, via `ST_BU_TO_GUSTO_DEPT`. Only
  four pairs are mapped today (`HVAC - Install`→`HVAC-Install`, `HVAC - Service`→`HVAC-Service`,
  `HVAC - Sales`→`HVAC-Sales`, `Plumbing - Service`→`Plumbing`). Anything unmapped is
  `unmapped`, **not** `differs` — a missing mapping is our gap, not the data's. Real case:
  Scott Clark is ST business unit `Warehouse`, Gusto department `Warehouse`; they agree but
  the pair isn't in the map, so a naive compare flags a false positive. Differ → `serious`.
- **`status`** — Gusto terminated vs ST active. Differ → **`critical`**. This is the whole
  point of the tool (§4c).

Everything else is `no_field_in_st` and renders as such: title, hire date, worker type, FLSA.

### 4c. Severity

`critical` is reserved for **terminated in Gusto but active in ServiceTitan**. A person who
left the company is still dispatchable to a customer's home. Nothing else earns red.

This group had **14 people in it this morning**, one of them wrong for 17 months, and it
went to **0** after PR #224 (see §11). Both the populated and empty states need to look
right, because the empty state is the one you want people to see.

`serious` — department disagreement, or an orphan that matters operationally (a Gusto-active
field employee with no ST record can't be dispatched).
`warning` — name formatting or nickname drift.
`ok` — agrees.

### 4d. Tests — use real fixtures, not invented people **[CORRECTED]**

The original's fixtures (Robert/Bob Smith, Maria Gonzalez, Jon Kowalski) are fictional. Our
real data is harder and the engine should be tested against it. Verified values as of
2026-08-03:

| Case | Fixture | Expected |
|---|---|---|
| Nickname link | Gusto `Christopher Heil` ↔ ST `Chris Heil` | linked, `name: differs`, `warning`. *(Jon fixed this in ST on 2026-08-03; it is now `Christopher Heil` at id `170801569`. Keep as a regression fixture.)* |
| Trailing punctuation | ST `Christina Lewis.` tech `55013867` ↔ Gusto `Christina Lewis` | linked after normalization, `name: match` |
| Parenthetical suffix | ST `Matt Mims (Office)` emp `137227159` | normalizes to `Matt Mims`, links |
| Three ST records, one human | Matt Mims emp `136714622` / `136722691` / `137227159` | one pair holding three ST identities |
| Two id namespaces | Colton Hill tech `178117016` + emp `136976205` | one pair, both ids, no collision |
| No surname | ST `Arturo` ↔ Gusto `Arturo Reyes` | below auto-link; suggest-and-confirm |
| Business entity | Gusto `R.V. & Sons` (null first/last) ↔ AP `Roger [RV & Sons]` | linked on email; must not crash on null names |
| Not a person | ST `*After Hours` emp `188046897`, `Install Team` emp/tech `34199570` | orphan, dispositionable (§6 P4) |
| New hire, no ST record | Gusto `Bilal Aloklah`, hired 2026-08-03 | orphan, `serious`, **not** an error — hired today |
| Unmapped BU | Scott Clark ST `Warehouse` / Gusto `Warehouse` | `unmapped`, must **not** report `differs` |
| Terminated, ST inactive | Gusto `Robert Lewis` (terminated) | `status: match`, no callout |

Also assert: `no_field_in_st` never counts toward a disagreement total, and terminated people
are excluded from any "% aligned" metric (§6 P1).

---

## 5. Styling **[CORRECTED — reuse the existing theme]**

The original proposed a fresh token palette. This app already has a portal-controlled
light/dark theme driven by the `ca_theme` cookie on `.christmasair.com`, with CSS variables
the whole fleet shares. Use those: `--bg-secondary`, `--bg-tertiary`, `--text-primary`,
`--text-secondary`, `--text-muted`, `--border-subtle`, `--brand-primary`. Brand is white /
green / maroon.

Add **only** what's genuinely missing: severity variables. Keep the original's palette
values for those if they clear contrast in both themes, and define them as variables so
they theme properly rather than hardcoding hex in components.

**Keep these rules from the original — they're right and the current build violates them:**

- Severity is conveyed by **icon + word**, never color alone. The committed chips are
  color-only. This is a real a11y gap.
- Only wash fields that differ; matching fields stay in default ink.
- Red is reserved for status/compliance conflicts only.

---

## 6. The six patterns

Acceptance criteria as checkboxes. **Check §11 first** — most of these have a starting point.

### Pattern 1 — Summary scorecard
Tiles: total linked, agrees, needs review, critical, only-in-one-system.
- [ ] Counts come from the engine, never hardcoded
- [ ] Clicking a tile filters the triage queue
- [ ] **Denominator excludes terminated people.** They will always disagree with ST and
      that's correct, not a defect. Including them pegs the score at a permanently
      unwinnable number, which is the fastest way to make someone stop looking.
- [ ] Progress is computed from live data on every load, never from anything self-reported
- [ ] Responsive 5-up → 2-up

### Pattern 2 — Side-by-side field diff
Two columns, Gusto | ServiceTitan, severity rail.
- [ ] Matching fields quiet; only differences washed
- [ ] Character-level name diff (`Chris` vs `Christopher` highlights the differing chars)
- [ ] `no_field_in_st` fields read "no field in ServiceTitan" and are visually neutral
- [ ] Handles a person with multiple ST records (Matt Mims has three)
- [ ] Handles null first/last on contractor entities without crashing
- [ ] Severity badge is icon + word

### Pattern 3 — Match-confidence meter
For the 0.6–0.9 band.
- [ ] Reasons list comes from §4a signals, with each shown as raising or lowering the score
- [ ] States plainly that name is currently the only cross-system key, so mid-band scores
      mean "similar names," not "probably the same person"
- [ ] Confirm links the pair; Not-a-match splits to two orphans; Decide-later snoozes
- [ ] Confirmed links **persist** — a re-sync must not re-guess a human's decision

### Pattern 4 — Only-in-one-system cards
- [ ] Names which system has the record and which lacks it
- [ ] Direction-specific actions
- [ ] **Wire to the existing disposition API, don't rebuild it.** `POST /api/people-disposition`
      takes `{system, external_id, external_name, disposition}` where disposition is
      `not_a_person | vendor | system_account | unmanaged`, or `null` to undo. Table
      `hr_people_dispositions`, migration 005. Requires `hr_hub.can_manage_templates`.
- [ ] Dispositioned records leave the list permanently and are undoable
- [ ] A brand-new hire (Bilal, hired today) does not read as an error

### Pattern 5 — Triage queue
- [ ] Filter chips filter rows and update counts live
- [ ] Owner-side value is the emphasized default (§2)
- [ ] Keyboard accessible, real focusable controls
- [ ] **No "mark as done" checkbox** — see §8

### Pattern 6 — Status-conflict callout
- [ ] Renders only for terminated-in-Gusto / active-in-ST
- [ ] Impact copy states the consequence, not the field delta
- [ ] Design the **zero state** deliberately. It is currently zero, and a group that went
      from lying to you to telling the truth is worth showing rather than hiding.

---

## 7. Architecture

- Pure logic in `lib/reconcile/` (or extend `lib/people-match.ts`). No React.
- The existing `GET /api/people-align` already computes exception groups and side-by-side
  pairs server-side and is permission-gated. Extend it; don't add a parallel endpoint.
- Gate on `hr_hub.can_access` to read, `hr_hub.can_manage_templates` to change dispositions
  or confirm links. Follow the pattern in `app/api/ladder-edit/route.ts`.
- Persist link confirmations the way dispositions are persisted (own table, keyed to the
  external ids, undoable, attributed to a user).
- URL-driven filter and selection state so views are linkable.

---

## 8. Why there is no "done" checkbox

Load-bearing, and Jon has confirmed it. The fix list recomputes from source on every load,
so an item disappears when the underlying record actually changes. Self-reported completion
is what makes reconciliation tools rot: someone ticks a box, gets distracted, and the list
now says clean while ServiceTitan says otherwise. Bank reconciliation works because next
month's statement confirms it independently.

**Dispositions are the deliberate exception, and the distinction is the reason they're safe.**
A disposition records *what a record is* — "`*After Hours` is not a person" stays true
indefinitely. A completion claim records *that someone did something*, which goes stale the
moment the source system changes. Classifications don't rot. Claims do.

**Gamification therefore has to be driven by recomputed state, not by clicks.** That's also
better: a number that goes up because ServiceTitan actually changed cannot be gamed and
cannot lie to you later. Ticking your own box is marking your own homework; watching the
count drop is a score.

---

## 9. Build order

1. **Engine + real fixtures + tests** (§3, §4). No test framework exists in `hr-hub` yet —
   add vitest scoped to `lib/`. This is the highest-value step and it's currently missing.
2. **Severity variables + shared primitives** — `SeverityBadge` (icon + word), `SystemTag`,
   `NameDiff`. Fixes the color-only a11y gap.
3. **Redesign Patterns 2 and 5** over the committed versions.
4. **Pattern 1** wired to engine counts, cross-filtering the queue.
5. **Pattern 3** (new), **Pattern 4** onto the existing disposition API, **Pattern 6** redesign.
6. Persist link confirmations; a11y pass; verify both themes.

**And the thing the original didn't ask for: the tab bar.** Six flat pills with counts is
placeholder work. Jon called it out directly. It needs designing.

---

## 10. Confirm, don't guess

- **Should we sync ServiceTitan phone numbers?** ST exposes `phoneNumber` / `mobilePhone` on
  technicians — we already use it to text journey links (`hr-hub/lib/servicetitan.ts`) — but
  it isn't stored in any mirror. Syncing it would add the single strongest corroborating
  signal to linking, which is currently name-only. Small sync change, large accuracy win.
- **Where do resolved values get written?** Today: nowhere. The fix list tells a human what
  to change in ServiceTitan and they do it by hand. Write-back to ST for employee records is
  unproven and would need its own review.
- **The nickname list.** Real preferred names are already in Gusto (Hemi, Ozzy, Kat, Eli,
  Ben, Lance) so the engine should read them rather than hardcode a map. Confirm whether any
  additional aliases exist that Gusto doesn't know about.
- **Business-unit → department mapping is incomplete.** Four pairs are mapped. `Warehouse`,
  `HVAC-Admin`, `HVAC-CX`, `HVAC-Apprentice`, `Plumbing-Admin`, `Plumbing-Apprentice`,
  `Marketing`, `Executive`, `Admin-Shared Service` are not. Needs a decision per pair:
  real mapping, or deliberately unmapped.
- **Two open data questions from Jon, still unanswered.** Is `1st protection TX` (active and
  paid in AP, absent from Gusto) deliberately outside payroll? Is Christi Medlock's
  simultaneous active-W-2 *and* active-1099 status in Gusto intentional? Both change
  disposition rules.

---

## 11. What already exists

Branch `feat/hr-people-explorer`, worktree `../debrief-tools-hr`, not pushed.

| Piece | Where | State |
|---|---|---|
| Raw explorer, 5 systems unfiltered | `app/(dashboard)/people/PeopleExplorer.tsx` | works; tab bar needs design |
| Fix list, grouped by where the fix lives | `app/(dashboard)/people/FixList.tsx` | works; **Pattern 5 + 6 start here** |
| Side-by-side pairs | `app/(dashboard)/people/SideBySide.tsx` | works; **Pattern 2 starts here**; has the Pattern 1 progress bar |
| Matching engine | `lib/people-match.ts` | works, crude nickname rule, **no tests** |
| Align API (groups + pairs) | `app/api/people-align/route.ts` | extend this |
| Explorer API | `app/api/people-explorer/route.ts` | raw reads, no compensation |
| Disposition API + table | `app/api/people-disposition/route.ts`, migration 005 | **Pattern 4 wires to this** |
| Gusto snapshot | `hr_gusto_snapshot`, 133 rows | pay/DOB/garnishments/PTO stripped |

**Related, already shipped to production:** PR #224 fixed a bug where no ServiceTitan mirror
could detect a deactivation — the sync omitted the `active` query parameter, which ST treats
as active-only, so deactivated people silently kept their last known state. `pr_employees`
went from 112 active / 0 inactive to 91 / 132, and all 39 terminated people it holds
corrected. Before that fix, any status reconciliation would have been reading a mirror
that structurally could not report a deactivation. Worth knowing when you wonder why
Pattern 6 is empty.
