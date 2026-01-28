-- Migration: Add membership flag to invoices table
-- Run this in Supabase SQL Editor

ALTER TABLE ar_invoices
ADD COLUMN IF NOT EXISTS has_membership BOOLEAN DEFAULT FALSE;

-- Add index for filtering by membership
CREATE INDEX IF NOT EXISTS idx_ar_invoices_has_membership ON ar_invoices(has_membership);
