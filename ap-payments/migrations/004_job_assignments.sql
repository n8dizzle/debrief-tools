-- AP Payments: Install Jobs tab — multiple technicians/subcontractors per job.
-- Parallel to the existing single assignment_type/contractor_id on ap_install_jobs
-- (Payment Tracker / Board), which is left untouched.
--
-- Pay columns are included now (nullable) so the Slice 2 pay work doesn't need another
-- migration. Slice 1 only writes the assignment columns.

CREATE TABLE IF NOT EXISTS ap_job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES ap_install_jobs(id) ON DELETE CASCADE,
  assignee_type TEXT NOT NULL CHECK (assignee_type IN ('technician','subcontractor')),
  technician_id UUID REFERENCES ap_technicians(id),   -- set when assignee_type='technician'
  contractor_id UUID REFERENCES ap_contractors(id),   -- set when assignee_type='subcontractor'

  -- Pay (Slice 2+). Null in Slice 1.
  pay_type_id UUID,                  -- FK to ap_pay_types (created in Slice 2)
  pay_amount NUMERIC(12,2),          -- confirmed pay for this person on this job
  pay_basis JSONB,                   -- snapshot of how it was computed (method + rate + inputs) for audit

  note TEXT,
  created_by UUID REFERENCES portal_users(id),
  updated_by UUID REFERENCES portal_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Exactly one of technician_id / contractor_id is set, matching assignee_type.
  CONSTRAINT ap_job_assignments_assignee_chk CHECK (
    (assignee_type = 'technician'   AND technician_id IS NOT NULL AND contractor_id IS NULL) OR
    (assignee_type = 'subcontractor' AND contractor_id IS NOT NULL AND technician_id IS NULL)
  )
);

-- One assignment per person per job (no duplicates).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ap_job_assignments_tech
  ON ap_job_assignments(job_id, technician_id) WHERE technician_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ap_job_assignments_sub
  ON ap_job_assignments(job_id, contractor_id) WHERE contractor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ap_job_assignments_job ON ap_job_assignments(job_id);
