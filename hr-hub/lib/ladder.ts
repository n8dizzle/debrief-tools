// ─────────────────────────────────────────────────────────────────────────────
// HVAC Install Progression & Skill Map
// Static reference content transcribed verbatim from the "Install Progression &
// Skill Map" doc (supplement to the HVAC Install Pay Structure). This is the
// source of truth for the ladder itself; per-technician checkoff state lives in
// the DB (hr_tech_skill_status / hr_tech_ladder), keyed by these stable skill ids.
// ─────────────────────────────────────────────────────────────────────────────

export type SkillCategory = 'skill' | 'responsibility' | 'equipment';
export type PayKind = 'hourly' | 'commission';

export interface LadderSkill {
  /** Stable id: `${rungId}:${category}:${index}` — referenced by checkoff rows. */
  id: string;
  category: SkillCategory;
  text: string;
}

export interface LadderRung {
  id: string;
  /** e.g. "$18 / hr" or "4% (≈ $600 / $15K)" */
  payLabel: string;
  /** Numeric pay for auto-placement hints: dollars/hr for hourly, percent for commission. */
  payValue: number;
  skills: LadderSkill[];
  responsibilities: LadderSkill[];
  equipment: LadderSkill[];
}

export interface LadderStep {
  id: string;
  name: string;
  /** italic descriptor from the doc */
  subtitle: string;
  payKind: PayKind;
  /** short pay-range chip, e.g. "$18 → $21 / hr" */
  payRange: string;
  rungs: LadderRung[];
  /** graduation/promotion gate shown at the bottom of the step */
  gate: string;
}

// Helper to build skill lists with stable ids.
function mk(rungId: string, category: SkillCategory, items: string[]): LadderSkill[] {
  return items.map((text, i) => ({ id: `${rungId}:${category}:${i}`, category, text }));
}

export const LADDER: LadderStep[] = [
  {
    id: 'apprentice',
    name: 'Install Apprentice',
    subtitle:
      'Entry tier for new hires straight out of high school or trade school. Builds foundational skills under direct supervision.',
    payKind: 'hourly',
    payRange: '$18 → $21 / hr',
    gate: 'GRADUATION TO TECHNICIAN LEVEL 1 — 50 installs logged + practical skills check passed',
    rungs: [
      {
        id: 'apprentice_18',
        payLabel: '$18 / hr',
        payValue: 18,
        skills: mk('apprentice_18', 'skill', [
          'Entry level. Basic hand tools, safety protocols (PPE, ladder safety, lockout/tagout).',
          'Can identify common HVAC components by name.',
        ]),
        responsibilities: mk('apprentice_18', 'responsibility', [
          'Material runner, jobsite setup/cleanup, demo and haul-off, holding/handing tools.',
          'Always paired with senior tech.',
        ]),
        equipment: mk('apprentice_18', 'equipment', ['Assist only — no equipment owned yet.']),
      },
      {
        id: 'apprentice_19',
        payLabel: '$19 / hr',
        payValue: 19,
        skills: mk('apprentice_19', 'skill', [
          'Reads a tape measure accurately. Knows basic ductwork terminology.',
          'Can identify refrigerant lines, electrical whips, condensate lines.',
          'Comfortable on ladders and in attics.',
        ]),
        responsibilities: mk('apprentice_19', 'responsibility', [
          'Pulls and stages equipment. Assists with sheet metal cuts under supervision.',
          'Begins customer-facing etiquette (uniform, shoe covers, greetings).',
        ]),
        equipment: mk('apprentice_19', 'equipment', ['Flex duct and line sets, under direct supervision.']),
      },
      {
        id: 'apprentice_20',
        payLabel: '$20 / hr',
        payValue: 20,
        skills: mk('apprentice_20', 'skill', [
          'Cuts and installs basic duct board and flex duct under direction.',
          'Understands airflow basics (supply vs return).',
          'Can pressure test a line set with guidance. EPA 608 in progress.',
        ]),
        responsibilities: mk('apprentice_20', 'responsibility', [
          'Runs flex duct, hangs equipment with lead. Assists with brazing prep.',
          'Owns jobsite cleanliness end-of-day.',
        ]),
        equipment: mk('apprentice_20', 'equipment', ['Duct board and flex runs; condensate lines and condensate pumps.']),
      },
      {
        id: 'apprentice_21',
        payLabel: '$21 / hr',
        payValue: 21,
        skills: mk('apprentice_21', 'skill', [
          'EPA 608 certified. Brazes copper joints competently.',
          'Pulls a vacuum and reads micron gauge. Wires basic 24V thermostat connections.',
        ]),
        responsibilities: mk('apprentice_21', 'responsibility', [
          'Performs refrigerant line work with oversight. Sets condenser and air handler with lead.',
          'Pressure tests and evacuates systems.',
        ]),
        equipment: mk('apprentice_21', 'equipment', [
          'Line sets, disconnects, and basic 24V thermostats; sets condenser and air handler alongside the lead.',
        ]),
      },
    ],
  },
  {
    id: 'l1',
    name: 'Install Technician — Level 1',
    subtitle:
      'Graduated apprentices begin here at $22/hr. Hourly. Builds toward running standard changeouts with minimal support.',
    payKind: 'hourly',
    payRange: '$22 → $25 / hr',
    gate: 'PROMOTION TO LEVEL 2 — consistently solo on standard changeouts, skills signed off by lead',
    rungs: [
      {
        id: 'l1_22',
        payLabel: '$22 / hr',
        payValue: 22,
        skills: mk('l1_22', 'skill', [
          'Graduated apprentice. Can complete a standard changeout with light supervision.',
          'Reads load calcs and equipment specs. Understands sequence of operation.',
        ]),
        responsibilities: mk('l1_22', 'responsibility', [
          'Owns secondary scope on jobs (line set, electrical, condensate).',
          'Coaches apprentices on basics. Handles equipment startup checklist.',
        ]),
        equipment: mk('l1_22', 'equipment', ['Evaporator / cased coil swap; assists on single-stage changeout.']),
      },
      {
        id: 'l1_24',
        payLabel: '$24 / hr',
        payValue: 24,
        skills: mk('l1_24', 'skill', [
          'Diagnoses common startup faults. Installs and configures communicating thermostats.',
          'Modifies plenums and transitions on the fly. Understands static pressure measurement.',
        ]),
        responsibilities: mk('l1_24', 'responsibility', [
          'Runs a 2-person crew with apprentice on simple changeouts.',
          'Manages jobsite logistics for the day. Communicates updates to dispatch.',
        ]),
        equipment: mk('l1_24', 'equipment', ['Single-stage split system (AC + furnace or heat pump) — full changeout.']),
      },
      {
        id: 'l1_25',
        payLabel: '$25 / hr',
        payValue: 25,
        skills: mk('l1_25', 'skill', [
          'Runs standard changeouts with minimal check-in.',
          'Solid on single-stage systems; understands multi-stage prep and setup.',
          'Consistent, well-documented work.',
        ]),
        responsibilities: mk('l1_25', 'responsibility', [
          'Reliable crew lead on simple jobs. Consistent quality on own scope.',
          'Eligible for promotion to Level 2.',
        ]),
        equipment: mk('l1_25', 'equipment', ['Single-stage systems solo; assists on two-stage / multi-stage systems.']),
      },
    ],
  },
  {
    id: 'l2',
    name: 'Install Technician — Level 2',
    subtitle:
      'Runs standard residential installs solo. Top of the hourly ladder; commission unlocks at promotion to Level 3.',
    payKind: 'hourly',
    payRange: '$26 → $30 / hr',
    gate:
      'COMMISSION TRANSITION — promote to Level 3 at 4% of invoice (≈ $600 on $15K install) after 90+ days at top of hourly ladder with hurdles met',
    rungs: [
      {
        id: 'l2_26',
        payLabel: '$26 / hr',
        payValue: 26,
        skills: mk('l2_26', 'skill', [
          'Confident with high-efficiency equipment (variable speed, inverter, dual fuel).',
          'Reads wiring diagrams independently. Performs commissioning to manufacturer spec. Programs thermostats.',
        ]),
        responsibilities: mk('l2_26', 'responsibility', [
          'Leads straightforward installs end-to-end with lead checking in.',
          'Handles customer walkthrough and system orientation.',
        ]),
        equipment: mk('l2_26', 'equipment', ['Two-stage / multi-stage systems; communicating thermostats.']),
      },
      {
        id: 'l2_28',
        payLabel: '$28 / hr',
        payValue: 28,
        skills: mk('l2_28', 'skill', [
          'Performs Manual J/D basics. Comfortable with zoning systems, dampers, bypass setups.',
          'Mentors apprentices on technical skills. Documents jobs thoroughly.',
        ]),
        responsibilities: mk('l2_28', 'responsibility', [
          'Runs full crew on standard installs. Owns quality of own work and apprentice work.',
          'Beginning to handle customer escalations.',
        ]),
        equipment: mk('l2_28', 'equipment', ['Variable-speed / inverter / communicating systems; single-zone ductless mini-split.']),
      },
      {
        id: 'l2_30',
        payLabel: '$30 / hr',
        payValue: 30,
        skills: mk('l2_30', 'skill', [
          'Ready to run any standard residential install solo. CSAT consistently 90%+ on jobs led.',
          'Callback rate below threshold. Mentoring at least one apprentice.',
        ]),
        responsibilities: mk('l2_30', 'responsibility', [
          'Functions as senior tech on complex jobs.',
          'Eligible for promotion to Level 3 commission structure.',
        ]),
        equipment: mk('l2_30', 'equipment', ['Dual-fuel systems and multi-zone mini-splits — any standard residential install, solo.']),
      },
    ],
  },
  {
    id: 'l3',
    name: 'Install Technician — Level 3',
    subtitle:
      'First commission role. Runs complex residential end-to-end and grows into light commercial. Commission-only.',
    payKind: 'commission',
    payRange: '4% → 5% of invoice',
    gate: 'PROMOTION TO LEVEL 4 — leadership, sales, and warranty/recall hurdles sustained over 90+ days',
    rungs: [
      {
        id: 'l3_4',
        payLabel: '4% (≈ $600 / $15K)',
        payValue: 4,
        skills: mk('l3_4', 'skill', [
          'Promoted from Level 2 at $30/hr or hired in with proven install lead experience.',
          'Runs standard residential changeouts end-to-end. Comfortable with most equipment lines we install.',
        ]),
        responsibilities: mk('l3_4', 'responsibility', [
          'Owns the install from start to finish. Runs a 1–2 person crew.',
          'Customer walkthrough, system orientation, and clean handoff every time.',
        ]),
        equipment: mk('l3_4', 'equipment', ['All standard residential split systems and changeouts.']),
      },
      {
        id: 'l3_4_5',
        payLabel: '4.5% (≈ $675 / $15K)',
        payValue: 4.5,
        skills: mk('l3_4_5', 'skill', [
          'Handles complex residential (multi-zone, communicating, high-efficiency dual fuel) without support.',
          'Reads wiring diagrams and load calcs independently.',
        ]),
        responsibilities: mk('l3_4_5', 'responsibility', [
          'Manages crew of 2–3. Coordinates directly with dispatch and permitting.',
          'Resolves routine customer questions on-site without escalation.',
        ]),
        equipment: mk('l3_4_5', 'equipment', [
          'Complex residential — multi-zone, communicating, and high-efficiency dual-fuel systems; zoning.',
        ]),
      },
      {
        id: 'l3_5',
        payLabel: '5% (≈ $750 / $15K)',
        payValue: 5,
        skills: mk('l3_5', 'skill', [
          'Light commercial competence (RTUs, small package units). Specs alternatives in the field when needed.',
          'Begins identifying cross-department opportunities (duct cleaning, insulation, attic restoration).',
        ]),
        responsibilities: mk('l3_5', 'responsibility', [
          'Fully autonomous in the van. Mentors at least one lower-level technician through their progression.',
          'Handles change orders independently.',
        ]),
        equipment: mk('l3_5', 'equipment', ['Light commercial — package units (gas pack / heat pump) and small commercial RTUs.']),
      },
    ],
  },
  {
    id: 'l4',
    name: 'Install Technician — Level 4',
    subtitle:
      'The senior working-lead role. Top commission, plus explicit leadership, cross-department sales, and the lowest warranty/recall rate on the team.',
    payKind: 'commission',
    payRange: '5.5% → 6% of invoice',
    gate:
      'Falling below performance hurdles (CSAT, callback/warranty rate, mentoring) drops rate back one step until recovered',
    rungs: [
      {
        id: 'l4_5_5',
        payLabel: '5.5% (≈ $825 / $15K)',
        payValue: 5.5,
        skills: mk('l4_5_5', 'skill', [
          'Proven track record: CSAT 90%+ over 90+ days, warranty/recall rate among the lowest on the team.',
          'Reads any residential or light-commercial job with confidence.',
        ]),
        responsibilities: mk('l4_5_5', 'responsibility', [
          'Owns customer escalations for their crew and jobsites. Mentors at least one apprentice or technician per quarter.',
          'Actively flags cross-department selling opportunities — duct cleaning, insulation, attic restoration.',
          'Contributes to team training and jobsite standards.',
        ]),
        equipment: mk('l4_5_5', 'equipment', ['Full residential and light commercial range, fully autonomous.']),
      },
      {
        id: 'l4_6',
        payLabel: '6% (≈ $900 / $15K)',
        payValue: 6,
        skills: mk('l4_6', 'skill', [
          'Top of the ladder. All hurdles sustained, including the lowest warranty/recall rate on the team.',
          'Functions as a working leader for the install team — go-to person for the hardest jobs and toughest escalations.',
        ]),
        responsibilities: mk('l4_6', 'responsibility', [
          'Full ownership of crew quality, schedule, and customer experience.',
          'First point of contact for escalations across the install team.',
          'Consistently converts cross-department leads (duct cleaning, insulation, attic restoration) into booked work.',
          "Reduces management burden by running the van as if it's their own business.",
        ]),
        equipment: mk('l4_6', 'equipment', ['Any job — go-to for the most complex residential and light commercial installs.']),
      },
    ],
  },
];

// ── Derived helpers ──────────────────────────────────────────────────────────

export interface FlatRung extends LadderRung {
  stepId: string;
  stepName: string;
  payKind: PayKind;
  /** global 0-based order across all 15 rungs */
  order: number;
}

/** All 15 rungs, flattened in ladder order with a global index. */
export const FLAT_RUNGS: FlatRung[] = LADDER.flatMap((step) =>
  step.rungs.map((r) => ({
    ...r,
    stepId: step.id,
    stepName: step.name,
    payKind: step.payKind,
    order: 0, // filled below
  }))
).map((r, i) => ({ ...r, order: i }));

/** Every skill/responsibility/equipment item on a rung, in display order. */
export function rungItems(rung: LadderRung): LadderSkill[] {
  return [...rung.skills, ...rung.responsibilities, ...rung.equipment];
}

/** Total count of checkable items on a rung. */
export function rungItemCount(rung: LadderRung): number {
  return rung.skills.length + rung.responsibilities.length + rung.equipment.length;
}

const RUNG_BY_ID = new Map(FLAT_RUNGS.map((r) => [r.id, r]));
export function getRung(id: string | null | undefined): FlatRung | undefined {
  return id ? RUNG_BY_ID.get(id) : undefined;
}

/** Every valid skill id across the ladder — used to validate checkoff writes. */
export const ALL_SKILL_IDS: Set<string> = new Set(
  FLAT_RUNGS.flatMap((r) => rungItems(r).map((s) => s.id))
);

/** True if `id` matches a real rung id. */
export function isValidRungId(id: string | null | undefined): boolean {
  return !!id && RUNG_BY_ID.has(id);
}

// Highest hourly pay rate on the ladder ($30). Rates above this are past the hourly
// band (Level 3/4 are commission) and can't be inferred from an hourly number.
const MAX_HOURLY_RATE = Math.max(...FLAT_RUNGS.filter((r) => r.payKind === 'hourly').map((r) => r.payValue));

/**
 * Best-guess current rung from an hourly pay rate (hourly rungs only). Returns null
 * for rates above the hourly band — commission techs must be placed explicitly rather
 * than guessed into the top hourly rung.
 */
export function rungFromHourlyRate(rate: number | null | undefined): string | null {
  if (!rate || rate <= 0) return null;
  if (rate > MAX_HOURLY_RATE) return null; // beyond hourly ladder → place manually
  // Choose the highest hourly rung whose payValue is <= the tech's rate.
  const hourly = FLAT_RUNGS.filter((r) => r.payKind === 'hourly');
  let best: FlatRung | null = null;
  for (const r of hourly) {
    if (rate >= r.payValue && (!best || r.payValue > best.payValue)) best = r;
  }
  return best?.id ?? null;
}
