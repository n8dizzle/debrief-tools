-- AP Payments: technician pay types (Slice 2).
-- Pay Types are the comp STRUCTURES (method). The actual numbers are per-technician.

CREATE TABLE IF NOT EXISTS ap_pay_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('percent','hourly','combo','flat')),
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the four structures (idempotent on name).
INSERT INTO ap_pay_types (name, method, sort_order)
SELECT v.name, v.method, v.ord FROM (VALUES
  ('% of Revenue', 'percent', 1),
  ('Hourly',       'hourly',  2),
  ('Hourly + %',   'combo',   3),
  ('Flat per job', 'flat',    4)
) AS v(name, method, ord)
WHERE NOT EXISTS (SELECT 1 FROM ap_pay_types p WHERE p.name = v.name);

-- A technician's configured pay arrangements. Numbers live here (per-technician).
-- A tech can have several (e.g. Hourly+% for installs, Hourly for service).
CREATE TABLE IF NOT EXISTS ap_technician_pay_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES ap_technicians(id) ON DELETE CASCADE,
  pay_type_id UUID NOT NULL REFERENCES ap_pay_types(id),
  hourly_rate NUMERIC(10,2),          -- used by hourly / combo
  percent NUMERIC(7,4),               -- used by percent / combo (e.g. 8 = 8%)
  flat_amount NUMERIC(12,2),          -- used by flat
  default_job_types TEXT[] DEFAULT '{}',  -- ST job_type_name values this config is the default for
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ap_tech_pay_types_tech ON ap_technician_pay_types(technician_id);
