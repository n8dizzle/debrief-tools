-- Migration 004: Add In-house Financing tracking fields to ar_invoice_tracking
-- Run this migration in Supabase SQL Editor

-- Add financing-specific fields to track payment plan details per invoice
ALTER TABLE ar_invoice_tracking
ADD COLUMN IF NOT EXISTS financing_monthly_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS financing_due_day INTEGER CHECK (financing_due_day IS NULL OR (financing_due_day >= 1 AND financing_due_day <= 28)),
ADD COLUMN IF NOT EXISTS financing_start_date DATE,
ADD COLUMN IF NOT EXISTS financing_notes TEXT;

-- Add index for filtering invoices with financing setup
CREATE INDEX IF NOT EXISTS idx_ar_invoice_tracking_financing
ON ar_invoice_tracking(financing_monthly_amount)
WHERE financing_monthly_amount IS NOT NULL;

-- Note: Payment history is already stored in ar_payments table (synced from ServiceTitan)
-- This migration just adds the financing plan configuration to invoice tracking
