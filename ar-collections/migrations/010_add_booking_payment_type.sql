-- Migration: Add booking payment type to invoices table
-- This stores the payment type the customer indicated when booking the job
-- Run this in Supabase SQL Editor

ALTER TABLE ar_invoices
ADD COLUMN IF NOT EXISTS booking_payment_type TEXT;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_ar_invoices_booking_payment_type ON ar_invoices(booking_payment_type);
