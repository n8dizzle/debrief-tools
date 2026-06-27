-- Some ServiceTitan technicians have no businessUnitId but do have a free-text "team"
-- (e.g. "Plumbing Install", "Warehouse", "Management/CXR"). Capture it so cross-team
-- helpers on install jobs show a meaningful home team instead of "No team".

ALTER TABLE ap_technicians ADD COLUMN IF NOT EXISTS team TEXT;
