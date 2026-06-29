-- Link Shearer supplier invoices to the install job, via ServiceTitan Projects.
-- A Shearer PO = the sales estimate job #; that estimate's project also contains the
-- HVAC-Install job. We resolve PO -> estimate.projectId -> the BU-610 install job and
-- store its job number, so the Equipment-by-Job report (equipment % of revenue) joins
-- locally without live ST calls.
ALTER TABLE ap_supplier_invoices ADD COLUMN IF NOT EXISTS estimate_project_id BIGINT; ALTER TABLE ap_supplier_invoices ADD COLUMN IF NOT EXISTS linked_install_job_number TEXT; ALTER TABLE ap_supplier_invoices ADD COLUMN IF NOT EXISTS links_resolved_at TIMESTAMPTZ; ALTER TABLE ap_install_jobs ADD COLUMN IF NOT EXISTS st_project_id BIGINT; CREATE INDEX IF NOT EXISTS idx_ap_supplier_invoices_linkedjob ON ap_supplier_invoices(linked_install_job_number); CREATE INDEX IF NOT EXISTS idx_ap_install_jobs_project ON ap_install_jobs(st_project_id);
