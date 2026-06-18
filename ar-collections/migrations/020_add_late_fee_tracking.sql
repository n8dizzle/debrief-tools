-- Migration 020: Add late fee tracking to ar_invoice_tracking
-- A user-set checkbox to confirm a late fee has been applied on the invoice,
-- with an auto-stamped date so we know WHEN it was applied (matches the existing
-- day1_text_sent / certified_letter_sent / closed pattern).

ALTER TABLE ar_invoice_tracking
  ADD COLUMN IF NOT EXISTS late_fee_applied BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS late_fee_applied_date DATE;
