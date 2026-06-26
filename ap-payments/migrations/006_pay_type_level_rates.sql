-- AP Payments: move %-of-revenue, flat amount, and "Default for" job types to the PAY TYPE
-- level (shared policy). Hourly rate stays per-technician. (Refines migration 005.)

ALTER TABLE ap_pay_types
  ADD COLUMN IF NOT EXISTS percent NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS flat_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS default_job_types TEXT[] DEFAULT '{}';

-- These now live on the pay type, not per technician. (005 just shipped; minimal/no data.)
ALTER TABLE ap_technician_pay_types
  DROP COLUMN IF EXISTS percent,
  DROP COLUMN IF EXISTS flat_amount,
  DROP COLUMN IF EXISTS default_job_types;
