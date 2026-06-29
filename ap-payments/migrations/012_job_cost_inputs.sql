-- Manual per-install-job cost worksheet: hand-keyed Equipment / Material / Labor $.
-- Shown alongside invoice total with each as a % of invoice. Separate from ST-derived
-- margin so users can enter their own cost figures.
CREATE TABLE IF NOT EXISTS ap_job_cost_inputs ( job_id UUID PRIMARY KEY REFERENCES ap_install_jobs(id) ON DELETE CASCADE, equipment_amount NUMERIC(12,2), material_amount NUMERIC(12,2), labor_amount NUMERIC(12,2), updated_by UUID REFERENCES portal_users(id), updated_at TIMESTAMPTZ DEFAULT NOW() );
