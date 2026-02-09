-- Migration 017: Remove hardcoded CHECK constraint from job_status
-- This allows any job status from ar_job_statuses table to be used

-- Drop the CHECK constraint that limits job_status to hardcoded values
ALTER TABLE ar_invoice_tracking
  DROP CONSTRAINT IF EXISTS ar_invoice_tracking_job_status_check;

-- Also try the default constraint name format PostgreSQL might use
ALTER TABLE ar_invoice_tracking
  DROP CONSTRAINT IF EXISTS ar_invoice_tracking_check;

-- Note: The ar_job_statuses table (migration 013) provides the configurable list of statuses
-- The UI already validates against that table, so we don't need a foreign key constraint
