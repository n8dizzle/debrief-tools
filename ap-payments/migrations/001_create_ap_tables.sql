-- AP Payments: Subcontractor payment tracking for install jobs

-- Contractors table
CREATE TABLE ap_contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  payment_method TEXT,
  payment_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contractor rate cards
CREATE TABLE ap_contractor_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES ap_contractors(id) ON DELETE CASCADE,
  trade TEXT NOT NULL,
  job_type_name TEXT NOT NULL,
  rate_amount NUMERIC(10,2) NOT NULL,
  rate_type TEXT DEFAULT 'flat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (contractor_id, trade, job_type_name)
);

-- Install jobs synced from ServiceTitan
CREATE TABLE ap_install_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_job_id BIGINT UNIQUE NOT NULL,
  job_number TEXT NOT NULL,
  job_status TEXT,
  trade TEXT NOT NULL,
  job_type_name TEXT,
  business_unit_id BIGINT,
  business_unit_name TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  job_address TEXT,
  st_customer_id BIGINT,
  st_location_id BIGINT,
  scheduled_date DATE,
  completed_date DATE,
  job_total NUMERIC(10,2),
  summary TEXT,
  assignment_type TEXT DEFAULT 'unassigned',
  contractor_id UUID REFERENCES ap_contractors(id),
  assigned_by UUID REFERENCES portal_users(id),
  assigned_at TIMESTAMPTZ,
  payment_amount NUMERIC(10,2),
  payment_status TEXT DEFAULT 'none',
  payment_requested_at TIMESTAMPTZ,
  payment_approved_at TIMESTAMPTZ,
  payment_approved_by UUID REFERENCES portal_users(id),
  payment_paid_at TIMESTAMPTZ,
  payment_expected_date DATE,
  payment_method TEXT,
  payment_notes TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log
CREATE TABLE ap_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ap_install_jobs(id),
  contractor_id UUID REFERENCES ap_contractors(id),
  action TEXT NOT NULL,
  description TEXT,
  old_value TEXT,
  new_value TEXT,
  performed_by UUID REFERENCES portal_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync log
CREATE TABLE ap_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  jobs_processed INT DEFAULT 0,
  jobs_created INT DEFAULT 0,
  jobs_updated INT DEFAULT 0,
  errors TEXT,
  status TEXT
);

-- Indexes for common queries
CREATE INDEX idx_ap_install_jobs_status ON ap_install_jobs(assignment_type, payment_status);
CREATE INDEX idx_ap_install_jobs_contractor ON ap_install_jobs(contractor_id);
CREATE INDEX idx_ap_install_jobs_scheduled ON ap_install_jobs(scheduled_date);
CREATE INDEX idx_ap_install_jobs_trade ON ap_install_jobs(trade);
CREATE INDEX idx_ap_activity_log_job ON ap_activity_log(job_id);
CREATE INDEX idx_ap_activity_log_created ON ap_activity_log(created_at);
CREATE INDEX idx_ap_contractor_rates_contractor ON ap_contractor_rates(contractor_id);
