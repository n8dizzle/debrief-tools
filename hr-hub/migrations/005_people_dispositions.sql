-- 005: Dispositions for ServiceTitan records that are not people we manage.
--
-- The alignment fix list compares ServiceTitan against Gusto (the HR source of record).
-- Some ST records will never have a Gusto counterpart and never should: scheduling
-- placeholders (*After Hours, *Regular Hours), team buckets (CXR Team, Install Team),
-- vendors (rocketbarthvacllc, Sustain Media), and integration accounts.
--
-- This table records a judgment about WHAT A RECORD IS, which stays true indefinitely.
-- That is deliberately different from marking work "done" — a completion claim goes
-- stale the moment the underlying system changes, so the fix list has no such concept.
-- A classification does not rot, so it is safe to persist and safe to trust.
--
-- Dispositioned records drop out of the fix list permanently instead of reappearing on
-- every sync, and stay listed under their own heading so a mistake can be undone.

CREATE TABLE IF NOT EXISTS hr_people_dispositions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system         TEXT NOT NULL,          -- 'st_employee' | 'st_technician'
  external_id    TEXT NOT NULL,          -- the id in that system
  external_name  TEXT,                   -- name at disposition time, for display and audit
  disposition    TEXT NOT NULL,          -- see CHECK below
  note           TEXT,
  created_by     UUID,                   -- portal_users.id
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT hr_people_disp_system_chk
    CHECK (system IN ('st_employee', 'st_technician')),
  CONSTRAINT hr_people_disp_kind_chk
    CHECK (disposition IN ('not_a_person', 'vendor', 'system_account', 'unmanaged'))
);

-- One disposition per record per system. Re-dispositioning updates in place.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_people_disp_system_external
  ON hr_people_dispositions(system, external_id);

CREATE INDEX IF NOT EXISTS idx_hr_people_disp_kind
  ON hr_people_dispositions(disposition);
