-- Migration 019: Add payment_type category to ar_job_statuses + drop CHECK on tracking.payment_type
-- This makes the customer's planned payment method a configurable list managed in the Workflow tab,
-- mirroring how Work Status and Collection Status work.

-- Extend the category CHECK on ar_job_statuses so 'payment_type' is allowed alongside the existing values.
ALTER TABLE ar_job_statuses
  DROP CONSTRAINT IF EXISTS ar_job_statuses_category_check;
ALTER TABLE ar_job_statuses
  ADD CONSTRAINT ar_job_statuses_category_check CHECK (category IN ('work', 'collection', 'payment_type'));

-- Drop the hardcoded CHECK constraint on tracking so any payment_type key from ar_job_statuses can be stored.
ALTER TABLE ar_invoice_tracking
  DROP CONSTRAINT IF EXISTS ar_invoice_tracking_payment_type_check;

-- Seed the four existing values so current data keeps working and these show up immediately.
-- sort_order is scoped per-category in app code (see /api/settings/job-statuses POST).
INSERT INTO ar_job_statuses (key, label, category, sort_order) VALUES
  ('cash', 'Cash', 'payment_type', 1),
  ('check', 'Check', 'payment_type', 2),
  ('card', 'Card', 'payment_type', 3),
  ('financing', 'Financing', 'payment_type', 4)
ON CONFLICT (key) DO NOTHING;
