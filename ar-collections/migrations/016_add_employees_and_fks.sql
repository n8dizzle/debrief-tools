-- Add ST Employees table and foreign keys for task assignments
-- Run this migration in Supabase SQL Editor

-- ============================================
-- ST EMPLOYEES TABLE
-- ============================================

-- Create employees table if not exists
CREATE TABLE IF NOT EXISTS ar_st_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_employee_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_st_employees_active ON ar_st_employees(is_active) WHERE is_active = TRUE;

-- ============================================
-- ADD TASK ASSIGNMENT COLUMNS
-- ============================================

-- Add st_assigned_to column if not exists
ALTER TABLE ar_collection_tasks
  ADD COLUMN IF NOT EXISTS st_assigned_to BIGINT;

-- Add st_reported_by column if not exists
ALTER TABLE ar_collection_tasks
  ADD COLUMN IF NOT EXISTS st_reported_by BIGINT;

-- ============================================
-- ADD FOREIGN KEY CONSTRAINTS
-- ============================================

-- Foreign key for st_source_id -> ar_st_task_sources
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ar_collection_tasks_st_source_id_fkey'
  ) THEN
    ALTER TABLE ar_collection_tasks
      ADD CONSTRAINT ar_collection_tasks_st_source_id_fkey
      FOREIGN KEY (st_source_id) REFERENCES ar_st_task_sources(st_source_id);
  END IF;
END $$;

-- Foreign key for st_assigned_to -> ar_st_employees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ar_collection_tasks_st_assigned_to_fkey'
  ) THEN
    ALTER TABLE ar_collection_tasks
      ADD CONSTRAINT ar_collection_tasks_st_assigned_to_fkey
      FOREIGN KEY (st_assigned_to) REFERENCES ar_st_employees(st_employee_id);
  END IF;
END $$;

-- Foreign key for st_reported_by -> ar_st_employees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ar_collection_tasks_st_reported_by_fkey'
  ) THEN
    ALTER TABLE ar_collection_tasks
      ADD CONSTRAINT ar_collection_tasks_st_reported_by_fkey
      FOREIGN KEY (st_reported_by) REFERENCES ar_st_employees(st_employee_id);
  END IF;
END $$;

-- Indexes for assignment columns
CREATE INDEX IF NOT EXISTS idx_tasks_st_assigned_to ON ar_collection_tasks(st_assigned_to) WHERE st_assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_st_reported_by ON ar_collection_tasks(st_reported_by) WHERE st_reported_by IS NOT NULL;
