// How each workflow sub-step gets filled — the single source of truth shared by the
// deal checklist (deriveDealPipeline) and the workflow map (InstallTimeline). Pure &
// client-safe (no server imports). Title-based matchers, hardcoded for now.

export type AutoSignal = 'sold' | 'job' | 'scheduled' | 'installed' | 'invoiced' | 'paid' | 'payment_type';

// Map a sub-step title to a known ServiceTitan/debrief signal. Word boundaries matter:
// "as-signed" must not match "signed", "contract-or" must not match "contract".
export function autoSignalFor(title: string): AutoSignal | null {
  const t = (title || '').toLowerCase();
  if (/\bcontract\b|\bsigned\b|\bsold\b/.test(t)) return 'sold';
  if (/job created|created in servicetitan|st job/.test(t)) return 'job';
  if (/install date|repair scheduled/.test(t)) return 'scheduled';       // "repair scheduled" for warranty
  if (/system installed|\binstalled\b|startup|commission|repair complete/.test(t)) return 'installed'; // "repair completed" for warranty
  if (/payment type/.test(t)) return 'payment_type';
  if (/invoice/.test(t)) return 'invoiced';
  if (/\bpaid\b|balance|payment/.test(t)) return 'paid';
  return null;
}

export type EquipSignal = 'po_confirmed' | 'ordered' | 'staged';
export function equipmentSignalFor(title: string): EquipSignal | null {
  const t = (title || '').toLowerCase();
  if (/\bpo\b|purchase order|confirmed/.test(t)) return 'po_confirmed';
  if (/deliver|staged|at shop/.test(t)) return 'staged';
  if (/order/.test(t)) return 'ordered';
  return null;
}

// The four ways a step gets filled. Everything but 'manual' is automatic.
export type StepSource = 'servicetitan' | 'orders' | 'debrief' | 'manual';

export function classifyStepSource(stageName: string, title: string): { source: StepSource; auto: boolean } {
  if (/equipment/i.test(stageName) && equipmentSignalFor(title)) return { source: 'orders', auto: true };
  if (/crew assigned/i.test(title)) return { source: 'orders', auto: true };
  const sig = autoSignalFor(title);
  if (sig === 'payment_type') return { source: 'debrief', auto: true };
  if (sig) return { source: 'servicetitan', auto: true };
  return { source: 'manual', auto: false };
}

export const SOURCE_META: Record<StepSource, { label: string; hint: string }> = {
  servicetitan: { label: 'ServiceTitan', hint: 'Fills automatically from ServiceTitan' },
  orders: { label: 'Orders app', hint: 'Fills automatically from the Parts & Equipment app' },
  debrief: { label: 'Debrief form', hint: 'Fills automatically from the Estimate Debrief form' },
  manual: { label: 'Manual', hint: 'A person checks this off — the gap this tracker exists to catch' },
};
