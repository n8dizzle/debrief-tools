-- Migration: Add next appointment date to invoices table
-- This tracks if there's a scheduled future appointment for the job
-- Run this in Supabase SQL Editor

ALTER TABLE ar_invoices
ADD COLUMN IF NOT EXISTS next_appointment_date TIMESTAMP WITH TIME ZONE;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_ar_invoices_next_appointment ON ar_invoices(next_appointment_date);
