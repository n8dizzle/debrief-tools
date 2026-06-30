-- Component/system counts per install job, from the sold estimate's equipment lines
-- (condenser/coil/furnace/air-handler; accessories excluded). Drives standard
-- per-component labor for commission. Populated during sold-by resolution.
ALTER TABLE ap_install_jobs ADD COLUMN IF NOT EXISTS component_count INT; ALTER TABLE ap_install_jobs ADD COLUMN IF NOT EXISTS system_count INT;
