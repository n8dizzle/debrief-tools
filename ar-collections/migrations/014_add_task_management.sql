-- Task Management with ServiceTitan Sync Support
-- Run this migration in Supabase SQL Editor

-- ============================================
-- EXTEND AR_COLLECTION_TASKS FOR ST SYNC
-- ============================================

-- Add ST sync columns to existing ar_collection_tasks table
ALTER TABLE ar_collection_tasks
  ADD COLUMN IF NOT EXISTS st_task_id BIGINT UNIQUE,
  ADD COLUMN IF NOT EXISTS st_job_id BIGINT,
  ADD COLUMN IF NOT EXISTS st_customer_id BIGINT,
  ADD COLUMN IF NOT EXISTS st_source_id BIGINT,
  ADD COLUMN IF NOT EXISTS st_type_id BIGINT,
  ADD COLUMN IF NOT EXISTS st_resolution_id BIGINT,
  ADD COLUMN IF NOT EXISTS st_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'local'
    CHECK (sync_status IN ('local', 'pending_push', 'synced', 'push_failed', 'from_st')),
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES portal_users(id),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES portal_users(id);

-- Add indexes for ST sync columns
CREATE INDEX IF NOT EXISTS idx_tasks_st_task_id ON ar_collection_tasks(st_task_id) WHERE st_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_sync_status ON ar_collection_tasks(sync_status);
CREATE INDEX IF NOT EXISTS idx_tasks_st_job_id ON ar_collection_tasks(st_job_id) WHERE st_job_id IS NOT NULL;

-- ============================================
-- ST TASK CONFIG CACHE TABLES
-- ============================================

-- Task sources (e.g., "AR Collections", "Service Call")
CREATE TABLE IF NOT EXISTS ar_st_task_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_source_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task types (e.g., "Follow Up Call", "Send Email")
CREATE TABLE IF NOT EXISTS ar_st_task_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_type_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task resolutions (e.g., "Completed", "Cancelled", "Left Voicemail")
CREATE TABLE IF NOT EXISTS ar_st_task_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_resolution_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AR -> ST TYPE MAPPINGS
-- ============================================

-- Maps AR task types to ST task type and source IDs
CREATE TABLE IF NOT EXISTS ar_task_type_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ar_task_type TEXT NOT NULL UNIQUE
    CHECK (ar_task_type IN ('call', 'email', 'letter', 'escalation')),
  st_type_id BIGINT REFERENCES ar_st_task_types(st_type_id),
  st_source_id BIGINT REFERENCES ar_st_task_sources(st_source_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default mappings (IDs will be null until configured in Settings)
INSERT INTO ar_task_type_mappings (ar_task_type) VALUES
  ('call'), ('email'), ('letter'), ('escalation')
ON CONFLICT (ar_task_type) DO NOTHING;

-- ============================================
-- TASK SYNC LOG
-- ============================================

CREATE TABLE IF NOT EXISTS ar_task_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('push_to_st', 'pull_from_st', 'full_sync')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  tasks_pushed INTEGER DEFAULT 0,
  tasks_pulled INTEGER DEFAULT 0,
  tasks_updated INTEGER DEFAULT 0,
  errors TEXT,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_task_sync_log_started_at ON ar_task_sync_log(started_at);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE TRIGGER IF NOT EXISTS update_ar_task_type_mappings_updated_at
  BEFORE UPDATE ON ar_task_type_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
