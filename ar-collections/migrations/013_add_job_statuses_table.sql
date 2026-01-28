-- Configurable job statuses
CREATE TABLE IF NOT EXISTS ar_job_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default statuses
INSERT INTO ar_job_statuses (key, label, sort_order) VALUES
  ('qc_booked', 'QC Booked', 1),
  ('qc_completed', 'QC Completed', 2),
  ('job_not_done', 'Job Not Done', 3),
  ('need_clarification', 'Need Clarification', 4),
  ('construction', 'Construction', 5),
  ('tech_question', 'Tech Question', 6),
  ('emailed_customer', 'Emailed Customer', 7),
  ('called_customer', 'Called Customer', 8),
  ('payment_promised', 'Payment Promised', 9),
  ('financing_pending', 'Financing Pending', 10)
ON CONFLICT (key) DO NOTHING;

-- Create index for sorting
CREATE INDEX IF NOT EXISTS idx_ar_job_statuses_sort ON ar_job_statuses(sort_order);
