-- Migration: Switch from task_type enum to st_type_id foreign key
-- This simplifies the system to use ServiceTitan task types directly

-- Drop the task_type column constraint if it exists
ALTER TABLE ar_collection_tasks
  DROP CONSTRAINT IF EXISTS ar_collection_tasks_task_type_check;

-- Drop the old task_type column (we'll use st_type_id instead)
ALTER TABLE ar_collection_tasks
  DROP COLUMN IF EXISTS task_type;

-- Add foreign key constraint for st_type_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ar_collection_tasks_st_type_id_fkey'
  ) THEN
    ALTER TABLE ar_collection_tasks
      ADD CONSTRAINT ar_collection_tasks_st_type_id_fkey
      FOREIGN KEY (st_type_id) REFERENCES ar_st_task_types(st_type_id);
  END IF;
END $$;

-- Drop the ar_task_type_mappings table since we no longer need it
DROP TABLE IF EXISTS ar_task_type_mappings;
