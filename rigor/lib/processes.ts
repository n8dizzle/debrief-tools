// Process definitions. Hardcoded on purpose.
//
// parts-equipment tried making this configurable from a Settings screen and it was
// abandoned as over-built for where the workflow actually is. Adding or changing a
// process here means editing this file — a developer's job, not a manager's.
//
// A process is a list of steps. Each step names the role that holds an item while
// it sits there, and the moves available from it. That is the whole engine.

export type Role =
  | 'Parts Coordinator'
  | 'Warehouse'
  | 'Field'
  | 'Office';

export interface Step {
  key: string;
  label: string;
  /** Who holds an item while it sits at this step. null = nobody's queue. */
  role: Role | null;
  /** One-line description of what the holder is meant to do here. */
  doing: string;
  /** Steps reachable from here, with the button label that gets you there. */
  moves: { to: string; label: string; tone?: 'go' | 'warn' | 'quiet' }[];
  /** True when the item is no longer anyone's action — waiting on the world. */
  waiting?: boolean;
}

export interface Process {
  key: string;
  label: string;
  entry: string;
  steps: Step[];
}

// ── parts ─────────────────────────────────────────────────────────────
// One item = one part that still needs ordering. Not one estimate: an estimate can
// hold twelve parts at different stages, which is exactly what pe_orders cannot say.
//
// Nothing here closes itself. "at_shop" is the parts team's finish line, not the
// business's — the item keeps flowing to installed/invoiced/paid, read from
// ServiceTitan, and only reaches `paid` when money actually arrived.
export const PARTS: Process = {
  key: 'parts',
  label: 'Parts',
  entry: 'triage',
  steps: [
    {
      // Everything a sold estimate contains lands here first. A ServiceTitan line
      // item is not the same thing as a part somebody has to go buy: measured
      // 2026-08-07, of 211 unbilled line items, 106 were $0 CA- task codes ("work"),
      // 24 were memberships, and a handful were discounts and install labour.
      //
      // We deliberately do NOT guess which is which. Every filter we tried in
      // parts-equipment (business unit, title keyword, SKU prefix) was wrong often
      // enough to poison trust in the whole board. The Parts Coordinator decides,
      // one click, and the decision is recorded in rg_events.
      //
      // Useful side-effect: after a few weeks those recorded decisions tell us what
      // actually distinguishes a part from a task code — a rule learned from real
      // judgments instead of invented up front.
      key: 'triage',
      label: 'New — is it a part?',
      role: 'Parts Coordinator',
      doing: 'Sold work just landed. Decide what actually needs buying.',
      moves: [
        { to: 'needs_order', label: 'Yes — needs ordering', tone: 'go' },
        { to: 'not_needed', label: 'Not a part', tone: 'quiet' },
      ],
    },
    {
      key: 'needs_order',
      label: 'Needs order',
      role: 'Parts Coordinator',
      doing: 'Pick a supplier and place the order.',
      moves: [
        { to: 'ordered_ship', label: 'Ordered · ship to shop', tone: 'go' },
        { to: 'ordered_pickup', label: 'Ordered · we pick up', tone: 'go' },
        { to: 'backordered', label: 'Backordered', tone: 'warn' },
        { to: 'not_needed', label: 'Not a part', tone: 'quiet' },
      ],
    },
    {
      key: 'ordered_ship',
      label: 'Shipping to shop',
      role: 'Warehouse',
      doing: 'Watch for it to arrive, then receive it.',
      moves: [
        { to: 'at_shop', label: 'Arrived at shop', tone: 'go' },
        { to: 'backordered', label: 'Backordered', tone: 'warn' },
      ],
    },
    {
      key: 'ordered_pickup',
      label: 'To pick up',
      role: 'Warehouse',
      doing: 'Collect it from the supply house.',
      moves: [
        { to: 'at_shop', label: 'Picked up', tone: 'go' },
        { to: 'backordered', label: 'Backordered', tone: 'warn' },
      ],
    },
    {
      key: 'backordered',
      label: 'Backordered',
      role: 'Parts Coordinator',
      doing: 'Chase the supplier. Keep the customer informed.',
      moves: [
        { to: 'ordered_ship', label: 'Back on · shipping', tone: 'go' },
        { to: 'ordered_pickup', label: 'Back on · pickup', tone: 'go' },
        { to: 'not_needed', label: 'Not a part', tone: 'quiet' },
      ],
    },
    {
      key: 'at_shop',
      label: 'At the shop',
      role: 'Field',
      doing: 'Part is here. Schedule and install it.',
      moves: [{ to: 'installed', label: 'Installed', tone: 'go' }],
    },
    {
      key: 'installed',
      label: 'Installed',
      role: null,
      doing: 'Waiting on the invoice.',
      waiting: true,
      moves: [],
    },
    {
      key: 'invoiced',
      label: 'Invoiced',
      role: null,
      doing: 'Waiting on payment.',
      waiting: true,
      moves: [],
    },
    {
      key: 'paid',
      label: 'Paid',
      role: null,
      doing: 'Done — money collected.',
      waiting: true,
      moves: [],
    },
    {
      key: 'not_needed',
      label: 'Not a part',
      role: null,
      doing: 'Dismissed by a person, with a reason.',
      moves: [],
    },
  ],
};

export const PROCESSES: Process[] = [PARTS];

export function getProcess(key: string): Process | undefined {
  return PROCESSES.find(p => p.key === key);
}
export function getStep(processKey: string, stepKey: string): Step | undefined {
  return getProcess(processKey)?.steps.find(s => s.key === stepKey);
}
/** Every step a given role holds — this is what builds that role's board. */
export function stepsForRole(processKey: string, role: Role): Step[] {
  return getProcess(processKey)?.steps.filter(s => s.role === role) ?? [];
}
