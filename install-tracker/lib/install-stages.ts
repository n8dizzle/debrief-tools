// Seed model for the install pipeline map (Rung 1: hardcoded, read-only).
// This is the SEED, not the truth — the real process is validated by walking one
// real install end-to-end. Rung 2 moves this into the `install_nodes` table so the
// owner can edit/deepen it. Keep the shape close to that table's columns.

export type StageStatus = 'done' | 'active' | 'wait' | 'blocked';

export interface SubStep {
  title: string;
  detail: string;
}

export interface Stage {
  name: string;
  status: StageStatus;      // illustrative until Rung 6 wires live ServiceTitan status
  who: string;              // who owns this stage today
  tools: string;            // tools the work lives in today
  duration: string;         // typical elapsed time
  summary: string;          // what this stage is, in one line
  risk: string;             // what goes wrong when a ball is dropped here
  subSteps: SubStep[];
}

export const INSTALL_STAGES: Stage[] = [
  {
    name: 'Sold',
    status: 'done',
    who: 'Comfort Advisor → hands to Coordinator',
    tools: 'ServiceTitan, estimate-tool, financing portal',
    duration: 'same day',
    summary: 'Deal is closed and the job is real. Money and paperwork land before anything moves.',
    risk: 'Deposit not collected or contract unsigned — job looks "in flight" but is not funded.',
    subSteps: [
      { title: 'Contract signed', detail: 'customer accepts the proposal' },
      { title: 'Deposit collected', detail: 'or financing approved' },
      { title: 'Job created in ServiceTitan', detail: 'becomes the system of record' },
      { title: 'Handoff to install coordinator', detail: 'the baton pass that gets fumbled' },
    ],
  },
  {
    name: 'Permit',
    status: 'blocked',
    who: 'Install Coordinator',
    tools: 'City portals (each city differs), email, phone',
    duration: '2–10 days',
    summary: 'Some jobs need a city permit before install. ServiceTitan does not track this.',
    risk: 'Crew shows up before the permit clears. Illegal to start; truck roll wasted.',
    subSteps: [
      { title: 'Determine if permit needed', detail: 'depends on scope & city' },
      { title: 'Submit application', detail: 'portal or in person' },
      { title: 'Permit approved', detail: 'the gate that blocks scheduling' },
    ],
  },
  {
    name: 'Equipment',
    status: 'active',
    who: 'Purchasing / Warehouse',
    tools: 'Supplier portals, POs, warehouse whiteboard',
    duration: '1–14 days',
    summary: 'The right units and parts are ordered, delivered, and staged for the crew.',
    risk: 'Wrong or backordered equipment found on install day. Reschedule, unhappy customer.',
    subSteps: [
      { title: 'Equipment ordered', detail: 'PO to supplier' },
      { title: 'PO confirmed', detail: 'ship date known' },
      { title: 'Delivered & staged', detail: 'ready for the truck' },
    ],
  },
  {
    name: 'Scheduled',
    status: 'wait',
    who: 'Install Coordinator',
    tools: 'ServiceTitan dispatch board',
    duration: '—',
    summary: 'Crew, date, and customer are locked in — once permit + equipment are ready.',
    risk: 'Scheduled before prerequisites are met, so the day collapses at the last minute.',
    subSteps: [
      { title: 'Crew assigned', detail: 'right size & skill' },
      { title: 'Install date set', detail: 'on the dispatch board' },
      { title: 'Customer confirmed', detail: 'the day-before call' },
    ],
  },
  {
    name: 'Installed',
    status: 'wait',
    who: 'Install Crew / Lead',
    tools: 'ServiceTitan mobile, photos',
    duration: '1–3 days',
    summary: 'The work: old system out, new system in, started up, customer walked through it.',
    risk: 'Incomplete startup or missing photos — comes back as a callback later.',
    subSteps: [
      { title: 'Crew on site', detail: 'job in progress' },
      { title: 'System installed', detail: 'old out / new in' },
      { title: 'Startup & commissioning', detail: 'verify it runs right' },
      { title: 'Customer walkthrough', detail: 'teach the thermostat' },
    ],
  },
  {
    name: 'Inspection',
    status: 'wait',
    who: 'City Inspector (Coordinator schedules)',
    tools: 'City portals, phone',
    duration: '3–14 days',
    summary: 'Permitted jobs get a city inspection. A fail means a return trip and re-inspection.',
    risk: 'Inspection failed or never scheduled — job silently sits "almost done" for weeks.',
    subSteps: [
      { title: 'Inspection scheduled', detail: 'with the city' },
      { title: 'Inspection passed', detail: 'or corrections + re-inspect' },
    ],
  },
  {
    name: 'Closed / Paid',
    status: 'wait',
    who: 'Office / AP',
    tools: 'ServiceTitan, ap-payments, warranty registration',
    duration: '1–7 days',
    summary: 'Final money in, warranties registered, contractor paid, job truly done.',
    risk: 'Balance uncollected or warranty never registered — margin leaks, customer unprotected.',
    subSteps: [
      { title: 'Final invoice sent', detail: 'balance due' },
      { title: 'Balance collected', detail: 'money in' },
      { title: 'Warranty registered', detail: 'manufacturer + membership' },
      { title: 'Contractor pay run', detail: 'closes in ap-payments' },
    ],
  },
];

export const STATUS_LABEL: Record<StageStatus, string> = {
  done: 'Done',
  active: 'Active now',
  wait: 'Waiting',
  blocked: 'Blocked',
};
