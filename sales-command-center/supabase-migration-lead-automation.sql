-- Lead Assignment Automation Migration
-- Run this in Supabase SQL Editor
-- Adds: assignment audit log, notification tracking, cron lock, response timestamps

-- ============================================================================
-- 1. Lead Assignment Audit Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_assignment_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  advisor_id UUID REFERENCES comfort_advisors(id) ON DELETE SET NULL,
  lead_type TEXT NOT NULL CHECK (lead_type IN ('TGL', 'Marketed')),
  assigned_via TEXT NOT NULL CHECK (assigned_via IN ('round-robin', 'service-titan', 'manual')),
  queue_position INT,
  notification_status TEXT DEFAULT 'pending' CHECK (notification_status IN ('pending', 'sent', 'failed')),
  notification_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_log_lead ON lead_assignment_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_assignment_log_advisor ON lead_assignment_log(advisor_id);
CREATE INDEX IF NOT EXISTS idx_assignment_log_created ON lead_assignment_log(created_at DESC);

ALTER TABLE lead_assignment_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on lead_assignment_log" ON lead_assignment_log FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. Add notification + response tracking columns to leads
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'assigned_at') THEN
    ALTER TABLE leads ADD COLUMN assigned_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'contacted_at') THEN
    ALTER TABLE leads ADD COLUMN contacted_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'dm_sent_at') THEN
    ALTER TABLE leads ADD COLUMN dm_sent_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'scott_notified_at') THEN
    ALTER TABLE leads ADD COLUMN scott_notified_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'service_titan_customer_id') THEN
    ALTER TABLE leads ADD COLUMN service_titan_customer_id TEXT;
  END IF;
END $$;

-- ============================================================================
-- 3. Cron Lock (prevents overlapping poll runs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cron_lock (
  id TEXT PRIMARY KEY DEFAULT 'poll',
  locked_at TIMESTAMPTZ,
  locked_by TEXT
);

-- Insert default row
INSERT INTO cron_lock (id, locked_at, locked_by)
VALUES ('poll', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE cron_lock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on cron_lock" ON cron_lock FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. Backfill assigned_at for existing assigned leads
-- ============================================================================
UPDATE leads SET assigned_at = created_at WHERE assigned_advisor_id IS NOT NULL AND assigned_at IS NULL;
