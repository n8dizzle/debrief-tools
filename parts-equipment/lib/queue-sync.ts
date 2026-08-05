// Core logic for the estimates-API-sourced parts queue.
//
// Source of truth = ServiceTitan SOLD estimates. An estimate belongs in the queue
// while ANY of its line items still needs ordering — i.e. at least one item has a
// null `invoiceItemId` (not yet invoiced onto a job).
//
// `booked` therefore means EVERY item is invoiced, not "any". The old "any item
// invoiced" rule silently hid partly-invoiced estimates: measured 2026-08-05, 14
// estimates holding 20 unordered line items were invisible — one sold Jun 22 with
// 4 of 5 parts never ordered. A rule should not be the thing that hides work; a
// person should, via an explicit dismiss that leaves a trace.
//
// Some of what this surfaces is junk (placeholder/labor-matrix SKUs like
// "Template Item Material"). That is handled by human dismissal, not by guessing.
//
// Once every item has an invoiceItemId (all work booked onto a job), the estimate
// is "Scheduled" and leaves the queue.

export interface QueueEstimate {
  estimateId: number;
  jobNumber: string;
  customerId: number | null;
  businessUnit: string;
  name: string;
  subtotal: number;
  soldOn: string;          // ISO
  tech: string;            // Sold By name (blank if ST returns only an id — resolve via soldById)
  soldById: number | null; // technician id to resolve into the Sold By name
  warrantyType: string | null; // 'P' | 'P/L' | null  (CA-W- SKUs)
  booked: boolean;         // EVERY item invoiced onto a job (nothing left to order)
}

export interface ExistingOrder {
  id: number;
  st_estimate_id: number | null;
  status: string;          // open | completed | cancelled
  location: string | null;
  warranty: string | null;
  completed_by: string | null;
}

export interface QueuePlan {
  toInsert: QueueEstimate[];               // sold + unbooked + not already tracked
  toSchedule: ExistingOrder[];             // tracked & open, now booked -> Scheduled
  toReopen: ExistingOrder[];               // wrongly auto-completed, still unbooked -> back to open
}

const sname = (s: unknown): string =>
  typeof s === 'string' ? s : (s && typeof s === 'object' && 'name' in s ? String((s as any).name) : '');

// ── Routing helpers (moved from the old report sync) ─────────────────
export function isInstallBU(bu: string): boolean {
  const lower = (bu || '').toLowerCase();
  return lower.includes('install') || lower.includes('sales');
}
const INSTALL_KEYWORDS = ['txv', 'evaporator coil', 'evap coil'];
export function hasInstallKeyword(title: string): boolean {
  const t = (title || '').toLowerCase();
  return INSTALL_KEYWORDS.some(k => t.includes(k));
}
export function classifyType(businessUnit: string, estimateTitle: string): string {
  const bu = (businessUnit || '').trim().toLowerCase();
  const title = (estimateTitle || '').toLowerCase();
  if (title.includes('christmas list')) return 'Membership';
  if (title.includes('duct cleaning')) return 'Duct Cleaning';
  if (bu.startsWith('hvac')) return 'Service';
  if (bu.startsWith('plumbing')) return 'Plumbing';
  return '';
}
export function ownerForSubtype(subtype: string): string {
  return subtype === 'Membership' ? 'CXR Team'
    : subtype === 'Duct Cleaning' ? 'Install Dispatcher'
    : subtype === 'Plumbing' ? 'Plumbing Dispatcher'
    : 'Parts Coordinator';
}

/** Warranty SKU (CA-W-*) → warranty type; else null. */
export function warrantyTypeFor(items: Array<{ sku?: { name?: string }; name?: string; description?: string }>): string | null {
  const isW = items.some(it => (it.sku?.name || '').toUpperCase().startsWith('CA-W-'));
  if (!isW) return null;
  const hay = items.map(it => `${it.name || ''} ${it.description || ''}`).join(' ').toLowerCase();
  return hay.includes('labor') && hay.includes('part') ? 'P/L' : 'P';
}

/** Shape a raw ST estimate (from sales/v2 estimates list) into a QueueEstimate. */
export function toQueueEstimate(e: any): QueueEstimate | null {
  if (sname(e.status) !== 'Sold') return null;
  const items = (e.items || []) as Array<any>;
  if (items.length === 0) return null; // nothing to order
  // EVERY, not some — see the header note. An estimate stays in the queue as long as
  // one item still needs ordering.
  const booked = items.every(it => it.invoiceItemId != null);
  return {
    estimateId: Number(e.id),
    jobNumber: String(e.jobNumber ?? e.jobId ?? '').trim(),
    customerId: e.customerId != null ? Number(e.customerId) : null,
    businessUnit: (e.businessUnitName as string) || '',
    name: (e.name as string) || '',
    subtotal: Number(e.subtotal ?? e.total ?? 0),
    soldOn: (e.soldOn as string) || '',
    tech: sname(e.soldBy),
    soldById: typeof e.soldBy === 'number' ? (e.soldBy as number) : null,
    warrantyType: warrantyTypeFor(items),
    booked,
  };
}

/**
 * Diff the sold-estimate universe against what we already track.
 * Pure — no I/O. `soldEstimates` should already be filtered to status=Sold.
 */
export function buildQueuePlan(soldEstimates: QueueEstimate[], existing: ExistingOrder[]): QueuePlan {
  const byEst = new Map<number, ExistingOrder>();
  for (const o of existing) if (o.st_estimate_id != null) byEst.set(o.st_estimate_id, o);
  const soldById = new Map<number, QueueEstimate>();
  for (const e of soldEstimates) soldById.set(e.estimateId, e);

  const toInsert: QueueEstimate[] = [];
  for (const e of soldEstimates) {
    if (e.booked) continue;                 // already on a job -> not queue-worthy
    if (byEst.has(e.estimateId)) continue;  // already tracked
    toInsert.push(e);
  }

  const toSchedule: ExistingOrder[] = [];
  const toReopen: ExistingOrder[] = [];
  for (const o of existing) {
    if (o.st_estimate_id == null) continue;
    const est = soldById.get(o.st_estimate_id);
    if (!est) continue; // estimate not in current sold window -> leave alone (guardrail)
    if (o.status === 'open' && est.booked) {
      toSchedule.push(o); // got booked -> Scheduled
    } else if (o.status === 'completed' && !est.booked && !o.completed_by) {
      // Auto-completed (no human closed it) but the estimate is still unbooked ->
      // it was wrongly closed by the old report-based sync. Reopen it.
      toReopen.push(o);
    }
  }

  return { toInsert, toSchedule, toReopen };
}
