-- Marketing Hub Task Management
-- Run this migration in Supabase SQL Editor

-- Create marketing_tasks table
CREATE TABLE IF NOT EXISTS marketing_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL CHECK (task_type IN ('daily', 'weekly', 'monthly', 'one_time')),
  category TEXT CHECK (category IN ('social', 'gbp', 'reviews', 'reporting', 'other')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  due_date DATE,
  recurrence_day INTEGER, -- 0-6 for weekly (Sun=0), 1-31 for monthly
  assigned_to UUID REFERENCES portal_users(id),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES portal_users(id),
  notes TEXT,
  created_by UUID REFERENCES portal_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_status ON marketing_tasks(status);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_due_date ON marketing_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_assigned_to ON marketing_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_category ON marketing_tasks(category);

-- Enable RLS
ALTER TABLE marketing_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read all tasks
CREATE POLICY "Allow authenticated users to read marketing_tasks"
  ON marketing_tasks
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policy: Allow authenticated users to insert tasks
CREATE POLICY "Allow authenticated users to insert marketing_tasks"
  ON marketing_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policy: Allow authenticated users to update tasks
CREATE POLICY "Allow authenticated users to update marketing_tasks"
  ON marketing_tasks
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Allow authenticated users to delete tasks
CREATE POLICY "Allow authenticated users to delete marketing_tasks"
  ON marketing_tasks
  FOR DELETE
  TO authenticated
  USING (true);

-- Pre-seed common recurring tasks (templates)
INSERT INTO marketing_tasks (title, task_type, category, recurrence_day, description) VALUES
  ('Post to Facebook', 'daily', 'social', NULL, 'Create and publish daily Facebook content'),
  ('Post to Instagram', 'daily', 'social', NULL, 'Create and publish daily Instagram content'),
  ('Create weekly GBP post', 'weekly', 'gbp', 1, 'Write and publish weekly Google Business Profile update (Monday)'),
  ('Reply to new reviews', 'daily', 'reviews', NULL, 'Respond to any new Google reviews'),
  ('Generate weekly report', 'weekly', 'reporting', 5, 'Compile and share weekly marketing performance report (Friday)'),
  ('Generate monthly report', 'monthly', 'reporting', 1, 'Compile and share monthly marketing performance report (1st of month)');
