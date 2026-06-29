-- Capture who SOLD each install job (comfort advisor) for commission. Resolved from the
-- install job's ServiceTitan project -> the Sold estimate -> soldBy (a technician id ->
-- ap_technicians name). Also stores the estimate job # and sold date.
ALTER TABLE ap_install_jobs ADD COLUMN IF NOT EXISTS sold_by_st_technician_id BIGINT; ALTER TABLE ap_install_jobs ADD COLUMN IF NOT EXISTS sold_by_name TEXT; ALTER TABLE ap_install_jobs ADD COLUMN IF NOT EXISTS sold_estimate_job_number TEXT; ALTER TABLE ap_install_jobs ADD COLUMN IF NOT EXISTS sold_on DATE; ALTER TABLE ap_install_jobs ADD COLUMN IF NOT EXISTS sales_resolved_at TIMESTAMPTZ;
