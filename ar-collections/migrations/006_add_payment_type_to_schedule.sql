-- Migration: Add payment_type to financing expected payments table
-- Run this in Supabase SQL Editor

ALTER TABLE ar_financing_payments
ADD COLUMN IF NOT EXISTS payment_type TEXT;
