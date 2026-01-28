-- Migration: Add expected payments table for in-house financing tracking
-- Run this in Supabase SQL Editor

-- Expected payments table - tracks each scheduled payment and its status
CREATE TABLE IF NOT EXISTS ar_financing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES ar_invoices(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'missed', 'late', 'partial')),
  payment_date DATE,
  st_payment_id BIGINT,
  amount_paid DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one expected payment per invoice per due date
  UNIQUE(invoice_id, due_date)
);

-- Index for quick lookups by invoice
CREATE INDEX IF NOT EXISTS idx_financing_payments_invoice ON ar_financing_payments(invoice_id);

-- Index for finding overdue payments
CREATE INDEX IF NOT EXISTS idx_financing_payments_status_due ON ar_financing_payments(status, due_date);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_financing_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_financing_payments_updated_at ON ar_financing_payments;
CREATE TRIGGER trigger_financing_payments_updated_at
  BEFORE UPDATE ON ar_financing_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_financing_payments_updated_at();

-- Enable RLS
ALTER TABLE ar_financing_payments ENABLE ROW LEVEL SECURITY;

-- RLS policy - allow authenticated users to manage financing payments
CREATE POLICY "Allow authenticated users to manage financing payments"
  ON ar_financing_payments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
