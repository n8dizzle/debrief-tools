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

// The ways a step gets filled. Everything but 'manual' is automatic.
export type StepSource = 'servicetitan' | 'orders' | 'debrief' | 'ai' | 'manual';

export const VALID_SOURCES: StepSource[] = ['servicetitan', 'orders', 'debrief', 'ai', 'manual'];
export function isValidSource(v: unknown): v is StepSource {
  return typeof v === 'string' && (VALID_SOURCES as string[]).includes(v);
}

// The type shown on a step's badge. A stored source_type (set by a manager, or frozen
// when the step is moved) wins; otherwise fall back to inferring it from stage + title.
export function effectiveSource(stored: string | null | undefined, stageName: string, title: string): StepSource {
  return isValidSource(stored) ? stored : classifyStepSource(stageName, title).source;
}

export function classifyStepSource(stageName: string, title: string): { source: StepSource; auto: boolean } {
  const t = (title || '').toLowerCase();
  // Recall workflows: AI proposes the root cause; ServiceTitan flags the recall + links its cause.
  if (/ai cause|ai root cause|cause proposed/.test(t)) return { source: 'ai', auto: true };
  if (/recall visit|recall detected|causing (install|job)|classified/.test(t)) return { source: 'servicetitan', auto: true };
  if (/equipment/i.test(stageName) && equipmentSignalFor(title)) return { source: 'orders', auto: true };
  if (/crew assigned/i.test(title)) return { source: 'orders', auto: true };
  const sig = autoSignalFor(title);
  if (sig === 'payment_type') return { source: 'debrief', auto: true };
  if (sig) return { source: 'servicetitan', auto: true };
  return { source: 'manual', auto: false };
}

// A plain-English default summary of where a step's data comes from — the "pre-fill"
// for the editable source summary on the map. Derived from the same signal that
// auto-ticks the step, so it stays accurate. Managers can override it per step
// (install_nodes.source_summary); when that's blank, this default shows.
export function defaultSourceSummary(stageName: string, title: string, source?: StepSource): string {
  source = source ?? classifyStepSource(stageName, title).source;

  if (source === 'servicetitan') {
    switch (autoSignalFor(title)) {
      case 'sold': return 'Auto-fills when the estimate is marked Sold in ServiceTitan.';
      case 'job': return 'Auto-fills when the install job is created in ServiceTitan.';
      case 'scheduled': return 'Auto-fills when the install appointment is scheduled in ServiceTitan.';
      case 'installed': return 'Auto-fills when the job is marked complete in ServiceTitan.';
      case 'invoiced': return 'Auto-fills when ServiceTitan generates the invoice.';
      case 'paid': return 'Auto-fills when the ServiceTitan invoice balance reaches zero.';
    }
    return SOURCE_META.servicetitan.hint + '.';
  }

  if (source === 'orders') {
    switch (equipmentSignalFor(title)) {
      case 'po_confirmed': return 'Auto-fills when the PO is confirmed on the Parts & Equipment board.';
      case 'ordered': return 'Auto-fills when the equipment is ordered on the Parts & Equipment board.';
      case 'staged': return 'Auto-fills when the equipment is delivered and staged (Lewisville Shop) on the Parts & Equipment board.';
    }
    if (/crew assigned/i.test(title)) return 'Auto-fills when a crew or sub is set on the order in Parts & Equipment.';
    return SOURCE_META.orders.hint + '.';
  }

  if (source === 'debrief') return 'Auto-fills when the Estimate Debrief form records a payment type.';
  if (source === 'ai') return 'Proposed by AI from the job data; a person validates it.';

  // manual
  return 'Marked done by hand — no system feeds this yet, so this is a gap the tracker exists to catch.';
}

export const SOURCE_META: Record<StepSource, { label: string; hint: string }> = {
  servicetitan: { label: 'ServiceTitan', hint: 'Fills automatically from ServiceTitan' },
  orders: { label: 'Orders app', hint: 'Fills automatically from the Parts & Equipment app' },
  debrief: { label: 'Debrief form', hint: 'Fills automatically from the Estimate Debrief form' },
  ai: { label: 'AI', hint: 'AI proposes a root cause; a person validates it' },
  manual: { label: 'Manual', hint: 'A person checks this off — the gap this tracker exists to catch' },
};
