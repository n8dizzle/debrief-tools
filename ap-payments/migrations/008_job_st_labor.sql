-- AP Payments: the ACTUAL ServiceTitan crew + each person's clocked hours per install
-- job. Source of truth for "who worked it and for how long" so the pay drawer can
-- auto-list everyone with hours pre-filled, then a human sets each person's pay type
-- (commission / hourly / etc.) — the discretion ST performance pay can't capture.
--
-- Distinct from ap_job_assignments (the human pay assignment). This is ST facts;
-- that is what we decide to pay.

CREATE TABLE IF NOT EXISTS ap_job_st_labor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES ap_install_jobs(id) ON DELETE CASCADE,
  st_technician_id BIGINT NOT NULL,         -- ServiceTitan employee/technician id
  technician_id UUID REFERENCES ap_technicians(id),  -- our tech (null if unmatched)
  technician_name TEXT,                     -- snapshot for display
  hours NUMERIC(6,2),                       -- clocked hours from gross-pay-items (decimal)
  cost NUMERIC(12,2),                       -- ST-derived labor cost (optional)
  source TEXT,                              -- 'gross_pay' (clocked) | 'dispatch' (assigned, no time yet)
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (job_id, st_technician_id)
);

CREATE INDEX IF NOT EXISTS idx_ap_job_st_labor_job ON ap_job_st_labor(job_id);
