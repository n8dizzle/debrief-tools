-- Migration 018: Add Payment Deposits & QuickBooks Reconciliation
-- This adds tables for tracking payments from collection through to bank deposit

-- =============================================
-- QuickBooks OAuth Credentials
-- =============================================
CREATE TABLE IF NOT EXISTS ar_quickbooks_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ NOT NULL,
  company_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only allow one QB connection at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_ar_qb_credentials_single ON ar_quickbooks_credentials ((1));

-- =============================================
-- QuickBooks Payments Cache
-- =============================================
CREATE TABLE IF NOT EXISTS ar_qb_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qb_payment_id VARCHAR(255) NOT NULL UNIQUE,
  qb_customer_id VARCHAR(255),
  qb_customer_name VARCHAR(255),
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(100),
  payment_method_ref VARCHAR(255),
  deposit_to_account_ref VARCHAR(255),
  deposit_to_account_name VARCHAR(255),
  is_deposited BOOLEAN DEFAULT FALSE,
  deposit_date DATE,
  memo TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ar_qb_payments_date ON ar_qb_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_ar_qb_payments_deposited ON ar_qb_payments(is_deposited);
CREATE INDEX IF NOT EXISTS idx_ar_qb_payments_customer ON ar_qb_payments(qb_customer_name);

-- =============================================
-- Payment Reconciliation (Links ST to QB)
-- =============================================
CREATE TABLE IF NOT EXISTS ar_payment_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ServiceTitan side
  st_payment_id INTEGER,
  st_invoice_id INTEGER,
  st_customer_id INTEGER,
  -- QuickBooks side
  qb_payment_id VARCHAR(255),
  -- AR Collections reference
  ar_invoice_id UUID REFERENCES ar_invoices(id) ON DELETE SET NULL,
  -- Payment details
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_type VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255),
  -- Matching
  match_status VARCHAR(50) DEFAULT 'unmatched',
  match_confidence DECIMAL(3,2),
  matched_at TIMESTAMPTZ,
  matched_by UUID REFERENCES portal_users(id),
  -- Deposit tracking
  is_deposited BOOLEAN DEFAULT FALSE,
  deposit_date DATE,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ar_reconciliation_st_payment ON ar_payment_reconciliation(st_payment_id);
CREATE INDEX IF NOT EXISTS idx_ar_reconciliation_qb_payment ON ar_payment_reconciliation(qb_payment_id);
CREATE INDEX IF NOT EXISTS idx_ar_reconciliation_status ON ar_payment_reconciliation(match_status);
CREATE INDEX IF NOT EXISTS idx_ar_reconciliation_date ON ar_payment_reconciliation(payment_date);
CREATE INDEX IF NOT EXISTS idx_ar_reconciliation_deposited ON ar_payment_reconciliation(is_deposited);

-- =============================================
-- QuickBooks Sync Log
-- =============================================
CREATE TABLE IF NOT EXISTS ar_qb_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type VARCHAR(50) NOT NULL, -- 'payments', 'deposits', 'reconciliation', 'full'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_fetched INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  matches_found INTEGER DEFAULT 0,
  errors TEXT,
  status VARCHAR(50) DEFAULT 'running' -- 'running', 'completed', 'failed'
);

CREATE INDEX IF NOT EXISTS idx_ar_qb_sync_log_status ON ar_qb_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_ar_qb_sync_log_started ON ar_qb_sync_log(started_at DESC);

-- =============================================
-- Comments for documentation
-- =============================================
COMMENT ON TABLE ar_quickbooks_credentials IS 'QuickBooks Online OAuth2 credentials for API access';
COMMENT ON TABLE ar_qb_payments IS 'Cached payments from QuickBooks, including those in Undeposited Funds';
COMMENT ON TABLE ar_payment_reconciliation IS 'Links ServiceTitan payments to QuickBooks payments for reconciliation';
COMMENT ON TABLE ar_qb_sync_log IS 'Audit log for QuickBooks sync operations';

COMMENT ON COLUMN ar_qb_payments.is_deposited IS 'True if payment has been moved from Undeposited Funds to a bank account';
COMMENT ON COLUMN ar_payment_reconciliation.match_status IS 'unmatched, auto_matched, manual_matched, discrepancy';
COMMENT ON COLUMN ar_payment_reconciliation.match_confidence IS 'Confidence score 0.00-1.00 for auto-matches';
