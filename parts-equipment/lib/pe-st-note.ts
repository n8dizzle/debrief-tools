// ServiceTitan job-note write-back for Parts & Equipment.
//
// First event under test: when the parts team enters an order number on a board
// card and finishes (clicks out of the box), post a note back to the ST job:
//   "Parts ordered via Parts & Equipment — Order #<num> from <supplier> (logged by <actor>)"
//
// Deliberately conservative for the confidence-building phase:
//  - Fires only on the CLIENT's "committed" signal — the order # field was blank
//    when focused and non-blank when blurred (see commitOrderNum in useOrders).
//    Mid-typing autosaves never set this, so the whole value is sent, not a partial;
//    and editing an already-filled order # does not re-fire.
//  - Non-throwing: never breaks the order save it piggy-backs on.
//  - Records every attempt (success or failure) to pe_audit_log for visibility.
//  - Kill switch: set PE_ST_NOTE_WRITEBACK=false to disable without a deploy.

import { getServiceTitanClient } from '@/lib/servicetitan';
import { getServerSupabase } from '@/lib/supabase';

const DISABLED_VALUES = new Set(['false', '0', 'off', 'no']);

/** Default ON; disable by setting PE_ST_NOTE_WRITEBACK to false/0/off/no. */
export function stNoteWritebackEnabled(): boolean {
  const v = (process.env.PE_ST_NOTE_WRITEBACK || '').trim().toLowerCase();
  return !DISABLED_VALUES.has(v);
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

/**
 * When the client commits a freshly-entered order #, post the order note to the
 * ST job. Safe to call on every PATCH: it self-gates and never throws.
 */
export async function maybePostOrderNumberNote(opts: {
  updated: Record<string, unknown>;
  actor: string;
  committed: boolean;
}): Promise<void> {
  const { updated, actor, committed } = opts;
  try {
    if (!stNoteWritebackEnabled()) return;
    // Only fire on the client's explicit "order # finished" signal.
    if (!committed) return;

    const newNum = str(updated['order_num']);
    if (!newNum) return;

    // The app stores the ST job number in `job` and uses it directly as the ST
    // job id (see st_url construction in sync-estimates). Resolve it the same way.
    const jobId = parseInt(str(updated['job']), 10);
    if (!Number.isFinite(jobId) || jobId <= 0) {
      console.warn(`[pe-st-note] skip: order ${str(updated['id'])} has no numeric job ("${str(updated['job'])}")`);
      return;
    }

    const st = getServiceTitanClient();
    if (!st.isConfigured()) {
      console.warn('[pe-st-note] skip: ServiceTitan client not configured');
      return;
    }

    const supplier = str(updated['supplier']);
    const noteText =
      `Parts ordered via Parts & Equipment — Order #${newNum}` +
      (supplier ? ` from ${supplier}` : '') +
      ` (logged by ${actor})`;

    const ok = await st.postJobNote(jobId, noteText);

    // Visibility: log every attempt so we can watch the feature during rollout.
    const supabase = getServerSupabase();
    await supabase.from('pe_audit_log').insert({
      type: 'st_note',
      job_id: str(updated['job']),
      customer: str(updated['customer']),
      action: ok ? 'Posted order # to ST job' : 'ST note post FAILED',
      detail: ok ? noteText : `${noteText} — see server logs`,
      changed_by: actor,
    });
  } catch (err) {
    // Never let note write-back break the order save.
    console.error('[pe-st-note] unexpected error:', err);
  }
}
