-- Migration: Add ST job type name to invoices table
-- Run this in Supabase SQL Editor

ALTER TABLE ar_invoices
ADD COLUMN IF NOT EXISTS st_job_type_name TEXT;

-- Add index for filtering by job type
CREATE INDEX IF NOT EXISTS idx_ar_invoices_st_job_type_name ON ar_invoices(st_job_type_name);
