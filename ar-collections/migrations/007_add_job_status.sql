-- Migration: Add ST job status to invoices table
-- Run this in Supabase SQL Editor

ALTER TABLE ar_invoices
ADD COLUMN IF NOT EXISTS st_job_status TEXT;

-- Add index for filtering by job status
CREATE INDEX IF NOT EXISTS idx_ar_invoices_st_job_status ON ar_invoices(st_job_status);
