-- Migration 002: Add job fields to ar_invoices
-- Run this migration in Supabase SQL Editor after 001_create_ar_tables.sql

-- Add st_job_id to link invoices to their ServiceTitan jobs
ALTER TABLE ar_invoices
ADD COLUMN IF NOT EXISTS st_job_id BIGINT;

-- Add job_number for display purposes
ALTER TABLE ar_invoices
ADD COLUMN IF NOT EXISTS job_number TEXT;

-- Add technician name
ALTER TABLE ar_invoices
ADD COLUMN IF NOT EXISTS technician_name TEXT;

-- Make customer_id nullable (some invoices may not have customer linked yet)
ALTER TABLE ar_invoices
ALTER COLUMN customer_id DROP NOT NULL;

-- Create index on st_job_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_ar_invoices_st_job_id ON ar_invoices(st_job_id);

-- Create index on st_invoice_id for faster lookups during sync
CREATE INDEX IF NOT EXISTS idx_ar_invoices_st_invoice_id ON ar_invoices(st_invoice_id);

-- ============================================
-- DATA CLEANUP: Remove fake Report 249 data
-- ============================================
-- Before running the new Invoice API sync, we need to clean up
-- the fake data created by the Report 249 sync.
--
-- WARNING: This will delete all existing AR data!
-- Only run this if you're ready to do a fresh sync from the Invoice API.
--
-- Uncomment and run these statements after backing up any tracking data you want to keep:

-- DELETE FROM ar_invoice_tracking WHERE invoice_id IN (SELECT id FROM ar_invoices WHERE st_invoice_id = 0);
-- DELETE FROM ar_collection_notes WHERE invoice_id IN (SELECT id FROM ar_invoices WHERE st_invoice_id = 0);
-- DELETE FROM ar_invoices WHERE st_invoice_id = 0;

-- Or to completely reset and start fresh:
-- TRUNCATE TABLE ar_invoice_tracking CASCADE;
-- TRUNCATE TABLE ar_collection_notes CASCADE;
-- TRUNCATE TABLE ar_payments CASCADE;
-- TRUNCATE TABLE ar_invoices CASCADE;
-- TRUNCATE TABLE ar_customers CASCADE;
-- TRUNCATE TABLE ar_sync_log;
