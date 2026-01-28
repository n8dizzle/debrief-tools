-- Migration 003: Add In-house Financing tracking to ar_invoices
-- Run this migration in Supabase SQL Editor

-- Add has_inhouse_financing column to track jobs with In-house Financing tag
ALTER TABLE ar_invoices
ADD COLUMN IF NOT EXISTS has_inhouse_financing BOOLEAN DEFAULT FALSE;

-- Create index for filtering by In-house Financing
CREATE INDEX IF NOT EXISTS idx_ar_invoices_inhouse_financing ON ar_invoices(has_inhouse_financing) WHERE has_inhouse_financing = TRUE;

-- Note: The In-house Financing tag ID in ServiceTitan is 158479256
-- This will be populated during AR sync by checking job tags
