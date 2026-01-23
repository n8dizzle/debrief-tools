-- AR Collections Database Schema
-- Run this migration in Supabase SQL Editor

-- ============================================
-- AR INVOICES (synced from ServiceTitan)
-- ============================================
CREATE TABLE IF NOT EXISTS ar_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_invoice_id BIGINT UNIQUE NOT NULL,
  invoice_number TEXT NOT NULL,
  customer_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  invoice_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  last_payment_date DATE,
  days_outstanding INTEGER NOT NULL DEFAULT 0,
  aging_bucket TEXT NOT NULL DEFAULT 'current' CHECK (aging_bucket IN ('current', '30', '60', '90+')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partial', 'paid', 'written_off')),
  business_unit_id INTEGER,
  business_unit_name TEXT,
  job_type TEXT NOT NULL DEFAULT 'service' CHECK (job_type IN ('install', 'service')),
  customer_type TEXT NOT NULL DEFAULT 'residential' CHECK (customer_type IN ('residential', 'commercial')),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ar_invoices_customer_id ON ar_invoices(customer_id);
CREATE INDEX idx_ar_invoices_status ON ar_invoices(status);
CREATE INDEX idx_ar_invoices_aging_bucket ON ar_invoices(aging_bucket);
CREATE INDEX idx_ar_invoices_job_type ON ar_invoices(job_type);
CREATE INDEX idx_ar_invoices_balance ON ar_invoices(balance) WHERE balance > 0;

-- ============================================
-- AR INVOICE TRACKING (collection workflow)
-- ============================================
CREATE TABLE IF NOT EXISTS ar_invoice_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID UNIQUE NOT NULL REFERENCES ar_invoices(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES portal_users(id),
  job_status TEXT CHECK (job_status IN (
    'qc_booked', 'qc_completed', 'job_not_done', 'need_clarification',
    'construction', 'tech_question', 'emailed_customer', 'called_customer',
    'payment_promised', 'financing_pending', 'other'
  )),
  control_bucket TEXT NOT NULL DEFAULT 'ar_collectible' CHECK (control_bucket IN ('ar_collectible', 'ar_not_in_our_control')),

  -- QC Tracking
  qc_scheduled_date DATE,
  qc_completed_date DATE,
  qc_technician TEXT,

  -- Payment tracking
  payment_type TEXT CHECK (payment_type IN ('cash', 'check', 'card', 'financing')),
  financing_type TEXT CHECK (financing_type IN ('synchrony', 'wells_fargo', 'wisetack', 'ally', 'in_house', 'other')),
  financing_status TEXT CHECK (financing_status IN ('submitted', 'needs_signature', 'approved', 'funded', 'paid')),
  invoice_verified BOOLEAN NOT NULL DEFAULT FALSE,

  -- Collection workflow checkboxes
  day1_text_sent BOOLEAN NOT NULL DEFAULT FALSE,
  day1_text_date DATE,
  day2_call_made BOOLEAN NOT NULL DEFAULT FALSE,
  day2_call_date DATE,
  day3_etc BOOLEAN NOT NULL DEFAULT FALSE,
  day3_etc_date DATE,
  day7_etc BOOLEAN NOT NULL DEFAULT FALSE,
  day7_etc_date DATE,
  certified_letter_sent BOOLEAN NOT NULL DEFAULT FALSE,
  certified_letter_date DATE,
  closed BOOLEAN NOT NULL DEFAULT FALSE,
  closed_date DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ar_invoice_tracking_owner_id ON ar_invoice_tracking(owner_id);
CREATE INDEX idx_ar_invoice_tracking_control_bucket ON ar_invoice_tracking(control_bucket);
CREATE INDEX idx_ar_invoice_tracking_closed ON ar_invoice_tracking(closed);

-- ============================================
-- AR CUSTOMERS (aggregated customer data)
-- ============================================
CREATE TABLE IF NOT EXISTS ar_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_customer_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  total_outstanding DECIMAL(12,2) NOT NULL DEFAULT 0,
  oldest_invoice_date DATE,
  invoice_count INTEGER NOT NULL DEFAULT 0,
  collection_priority TEXT NOT NULL DEFAULT 'normal' CHECK (collection_priority IN ('low', 'normal', 'high', 'critical')),
  collection_status TEXT NOT NULL DEFAULT 'none' CHECK (collection_status IN ('none', 'contacted', 'promised', 'disputed', 'escalated')),
  next_followup_date DATE,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ar_customers_total_outstanding ON ar_customers(total_outstanding) WHERE total_outstanding > 0;
CREATE INDEX idx_ar_customers_collection_priority ON ar_customers(collection_priority);

-- ============================================
-- AR PAYMENTS (payment history)
-- ============================================
CREATE TABLE IF NOT EXISTS ar_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_payment_id BIGINT UNIQUE NOT NULL,
  invoice_id UUID REFERENCES ar_invoices(id),
  customer_id UUID NOT NULL REFERENCES ar_customers(id),
  amount DECIMAL(12,2) NOT NULL,
  payment_type TEXT,
  payment_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ar_payments_invoice_id ON ar_payments(invoice_id);
CREATE INDEX idx_ar_payments_customer_id ON ar_payments(customer_id);
CREATE INDEX idx_ar_payments_payment_date ON ar_payments(payment_date);

-- ============================================
-- AR COLLECTION TASKS
-- ============================================
CREATE TABLE IF NOT EXISTS ar_collection_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES ar_customers(id),
  invoice_id UUID REFERENCES ar_invoices(id),
  task_type TEXT NOT NULL CHECK (task_type IN ('call', 'email', 'letter', 'escalation')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID REFERENCES portal_users(id),
  due_date DATE,
  outcome TEXT,
  outcome_notes TEXT,
  followup_required BOOLEAN NOT NULL DEFAULT FALSE,
  followup_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ar_collection_tasks_status ON ar_collection_tasks(status);
CREATE INDEX idx_ar_collection_tasks_assigned_to ON ar_collection_tasks(assigned_to);
CREATE INDEX idx_ar_collection_tasks_due_date ON ar_collection_tasks(due_date);

-- ============================================
-- AR COLLECTION NOTES
-- ============================================
CREATE TABLE IF NOT EXISTS ar_collection_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES ar_invoices(id),
  customer_id UUID REFERENCES ar_customers(id),
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  author_initials TEXT NOT NULL,
  content TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'call' CHECK (note_type IN ('call', 'text', 'email', 'task', 'status_change', 'payment_promise')),
  contact_result TEXT CHECK (contact_result IN ('reached', 'voicemail', 'no_answer', 'left_message')),
  spoke_with TEXT,
  promised_amount DECIMAL(12,2),
  promised_date DATE,
  created_by UUID REFERENCES portal_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ar_collection_notes_invoice_id ON ar_collection_notes(invoice_id);
CREATE INDEX idx_ar_collection_notes_customer_id ON ar_collection_notes(customer_id);
CREATE INDEX idx_ar_collection_notes_note_date ON ar_collection_notes(note_date);

-- ============================================
-- AR SYNC LOG
-- ============================================
CREATE TABLE IF NOT EXISTS ar_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_created INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  errors TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX idx_ar_sync_log_started_at ON ar_sync_log(started_at);

-- ============================================
-- AR AGING SNAPSHOTS (daily snapshots for trending)
-- ============================================
CREATE TABLE IF NOT EXISTS ar_aging_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE UNIQUE NOT NULL,
  total_outstanding DECIMAL(12,2) NOT NULL DEFAULT 0,
  current_bucket DECIMAL(12,2) NOT NULL DEFAULT 0,
  bucket_30 DECIMAL(12,2) NOT NULL DEFAULT 0,
  bucket_60 DECIMAL(12,2) NOT NULL DEFAULT 0,
  bucket_90_plus DECIMAL(12,2) NOT NULL DEFAULT 0,
  install_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  service_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  ar_collectible DECIMAL(12,2) NOT NULL DEFAULT 0,
  ar_not_in_control DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ar_aging_snapshots_date ON ar_aging_snapshots(snapshot_date);

-- ============================================
-- AR PAYMENT PLANS (in-house financing tracker)
-- ============================================
CREATE TABLE IF NOT EXISTS ar_payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES ar_customers(id),
  invoice_id UUID REFERENCES ar_invoices(id),
  owner_id UUID REFERENCES portal_users(id),
  total_balance DECIMAL(12,2) NOT NULL,
  monthly_payment_amount DECIMAL(12,2) NOT NULL,
  payment_due_day INTEGER NOT NULL CHECK (payment_due_day >= 1 AND payment_due_day <= 28),
  start_date DATE NOT NULL,
  estimated_end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ar_payment_plans_customer_id ON ar_payment_plans(customer_id);
CREATE INDEX idx_ar_payment_plans_status ON ar_payment_plans(status);

-- ============================================
-- AR PAYMENT PLAN MONTHS
-- ============================================
CREATE TABLE IF NOT EXISTS ar_payment_plan_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES ar_payment_plans(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  payment_due DECIMAL(12,2) NOT NULL,
  payment_received DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_date DATE,
  amount_paid DECIMAL(12,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'late', 'missed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, year, month)
);

CREATE INDEX idx_ar_payment_plan_months_plan_id ON ar_payment_plan_months(plan_id);

-- ============================================
-- AR EMAIL TEMPLATES
-- ============================================
CREATE TABLE IF NOT EXISTS ar_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'reminder' CHECK (template_type IN ('reminder', 'past_due', 'final_notice', 'payment_plan')),
  days_overdue_trigger INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- AR EMAILS SENT
-- ============================================
CREATE TABLE IF NOT EXISTS ar_emails_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES ar_customers(id),
  invoice_id UUID REFERENCES ar_invoices(id),
  template_id UUID REFERENCES ar_email_templates(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_by UUID NOT NULL REFERENCES portal_users(id),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_snapshot TEXT NOT NULL
);

CREATE INDEX idx_ar_emails_sent_customer_id ON ar_emails_sent(customer_id);
CREATE INDEX idx_ar_emails_sent_sent_at ON ar_emails_sent(sent_at);

-- ============================================
-- AR SMS TEMPLATES
-- ============================================
CREATE TABLE IF NOT EXISTS ar_sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  body TEXT NOT NULL CHECK (length(body) <= 160),
  template_type TEXT NOT NULL DEFAULT 'reminder' CHECK (template_type IN ('reminder', 'past_due', 'final_notice', 'payment_plan')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- AR SMS SENT
-- ============================================
CREATE TABLE IF NOT EXISTS ar_sms_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES ar_customers(id),
  invoice_id UUID REFERENCES ar_invoices(id),
  template_id UUID REFERENCES ar_sms_templates(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_by UUID NOT NULL REFERENCES portal_users(id),
  recipient_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed'))
);

CREATE INDEX idx_ar_sms_sent_customer_id ON ar_sms_sent(customer_id);
CREATE INDEX idx_ar_sms_sent_sent_at ON ar_sms_sent(sent_at);

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ar_invoices_updated_at
  BEFORE UPDATE ON ar_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ar_invoice_tracking_updated_at
  BEFORE UPDATE ON ar_invoice_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ar_customers_updated_at
  BEFORE UPDATE ON ar_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ar_collection_tasks_updated_at
  BEFORE UPDATE ON ar_collection_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ar_payment_plans_updated_at
  BEFORE UPDATE ON ar_payment_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ar_payment_plan_months_updated_at
  BEFORE UPDATE ON ar_payment_plan_months
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ar_email_templates_updated_at
  BEFORE UPDATE ON ar_email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ar_sms_templates_updated_at
  BEFORE UPDATE ON ar_sms_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA: Default email templates
-- ============================================
INSERT INTO ar_email_templates (name, subject, body, template_type, days_overdue_trigger) VALUES
(
  'Payment Reminder',
  'Payment Reminder - Invoice #{invoice_number}',
  'Dear {customer_name},

This is a friendly reminder that your invoice #{invoice_number} for {balance} is now due.

Please remit payment at your earliest convenience.

If you have already sent your payment, please disregard this notice.

Thank you for your business!

Christmas Air Conditioning & Plumbing',
  'reminder',
  7
),
(
  'Past Due Notice',
  'Past Due Notice - Invoice #{invoice_number}',
  'Dear {customer_name},

Your invoice #{invoice_number} for {balance} is now past due.

Please contact us immediately to arrange payment or discuss payment options.

If you have any questions about this invoice, please call us at (555) 123-4567.

Thank you,
Christmas Air Conditioning & Plumbing',
  'past_due',
  30
),
(
  'Final Notice',
  'FINAL NOTICE - Invoice #{invoice_number}',
  'Dear {customer_name},

FINAL NOTICE

Your account is seriously past due. Invoice #{invoice_number} for {balance} requires immediate attention.

Please contact us within 5 business days to avoid further collection action.

Call us at (555) 123-4567 to discuss payment arrangements.

Christmas Air Conditioning & Plumbing',
  'final_notice',
  60
);

-- ============================================
-- SEED DATA: Default SMS templates
-- ============================================
INSERT INTO ar_sms_templates (name, body, template_type) VALUES
(
  'Payment Reminder SMS',
  'Hi {customer_name}, your Christmas Air invoice #{invoice_number} for {balance} is due. Please call (555) 123-4567 with questions.',
  'reminder'
),
(
  'Past Due SMS',
  'PAST DUE: Your Christmas Air invoice #{invoice_number} for {balance} requires immediate payment. Call (555) 123-4567.',
  'past_due'
);
