/**
 * Notification template constants shared between server and client code.
 */

export const DEFAULT_TEMPLATES: Record<string, string> = {
  assignment_contractor: 'Christmas Air: Job #{job_number} ({customer_name}, {trade}) at {address} assigned to you. Amount: {amount}',
  assignment_internal: 'AP: Job #{job_number} ({customer_name}) at {address} assigned to {contractor_name} for {amount}',
  pending_approval_manager: 'AP: Invoice of {amount} received for Job #{job_number} ({contractor_name}, {customer_name}) at {address} — please approve at ap.christmasair.com',
  ready_to_pay_internal: 'AP: Job #{job_number} ({contractor_name}, {amount}) approved and ready to pay{source_label}.',
  paid_contractor: 'Christmas Air: Payment of {amount} for Job #{job_number} ({customer_name}) at {address} sent{payment_method}.',
  paid_internal: 'AP: Payment of {amount} paid for Job #{job_number} — {contractor_name} ({customer_name} at {address}).',
  paid_manager: 'AP: Payment of {amount} paid for Job #{job_number} — {contractor_name} ({trade}, {customer_name}).',
  daily_reminder_manager: 'AP Reminder: You have {count} {trade} invoice(s) awaiting approval totaling {total}. Review at ap.christmasair.com',
  // Email subjects
  subject_assignment_internal: 'Job #{job_number} Assigned',
  subject_pending_approval_manager: 'Invoice Needs Approval — Job #{job_number}',
  subject_ready_to_pay_internal: 'Ready to Pay — Job #{job_number}',
  subject_paid_contractor: 'Subcontractor Payment — Job #{job_number}',
  subject_paid_internal: 'Subcontractor Payment — Job #{job_number}',
  subject_paid_manager: 'Subcontractor Payment — Job #{job_number}',
  subject_daily_reminder_manager: 'AP: {count} {trade} Invoice(s) Awaiting Your Approval',
};

export const TEMPLATE_KEYS: { key: string; label: string; group: 'message' | 'subject' }[] = [
  { key: 'assignment_contractor', label: 'Assignment → Contractor', group: 'message' },
  { key: 'assignment_internal', label: 'Assignment → Internal Team', group: 'message' },
  { key: 'pending_approval_manager', label: 'Pending Approval → Install Managers', group: 'message' },
  { key: 'ready_to_pay_internal', label: 'Ready to Pay → Internal Team', group: 'message' },
  { key: 'paid_contractor', label: 'Paid → Contractor', group: 'message' },
  { key: 'paid_internal', label: 'Paid → Internal Team', group: 'message' },
  { key: 'subject_assignment_internal', label: 'Assignment → Internal Team (Email Subject)', group: 'subject' },
  { key: 'subject_pending_approval_manager', label: 'Pending Approval → Managers (Email Subject)', group: 'subject' },
  { key: 'subject_ready_to_pay_internal', label: 'Ready to Pay → Internal (Email Subject)', group: 'subject' },
  { key: 'subject_paid_contractor', label: 'Paid → Contractor (Email Subject)', group: 'subject' },
  { key: 'subject_paid_internal', label: 'Paid → Internal Team (Email Subject)', group: 'subject' },
  { key: 'daily_reminder_manager', label: 'Daily Reminder → Trade Managers', group: 'message' },
  { key: 'subject_daily_reminder_manager', label: 'Daily Reminder → Managers (Email Subject)', group: 'subject' },
];

export const TEMPLATE_VARIABLES = [
  '{job_number}', '{customer_name}', '{contractor_name}', '{amount}', '{trade}', '{address}', '{payment_method}', '{source_label}', '{count}', '{total}',
];
