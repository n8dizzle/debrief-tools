-- Migration 002: Add 'needs_assignment' payment status
--
-- Context: Payment Tracker / Payment Board redesign (2026-05-18).
-- Jobs synced from ServiceTitan land as assignment_type='unassigned' with
-- payment_status='none'. We want unassigned jobs to surface as their own
-- queue on the Payment Board, distinct from contractor-assigned jobs
-- awaiting an invoice (which also use payment_status='none').
--
-- payment_status is a free TEXT column, so this is a pure data backfill —
-- no DDL required.
--
-- After this migration, the canonical mapping is:
--   assignment_type='unassigned' AND payment_status='needs_assignment'  → Needs Assignment queue
--   assignment_type='contractor' AND payment_status='none'              → assigned, awaiting invoice (Table view only)
--   assignment_type='contractor' AND payment_status='pending_approval'  → Pending Approval queue
--   assignment_type='contractor' AND payment_status='ready_to_pay'      → Ready to Pay queue
--   assignment_type='contractor' AND payment_status='paid'              → Paid queue
--   assignment_type='in_house'                                          → off the Payment Board, visible in Labor tab

-- Backfill existing unassigned jobs.
UPDATE ap_install_jobs
SET payment_status = 'needs_assignment',
    updated_at = NOW()
WHERE assignment_type = 'unassigned'
  AND payment_status = 'none';

-- Companion code changes (NOT in this migration — see PR):
--   - sync route sets payment_status='needs_assignment' for new unassigned jobs
--   - assign endpoint flips needs_assignment ↔ none on assignment changes
--   - PaymentStatusBadge, JobsTable filter chips, etc.
