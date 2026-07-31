-- 004: Onboarding persistence. Templates (phases/tasks/skills/docs) stay static in
-- components/onboarding/data.js; only per-employee files + mutable state persist here.
-- Employee columns match the ported app's object shape (name/title/dept/mgr/start/type).

DROP TABLE IF EXISTS hr_onboarding_state;
DROP TABLE IF EXISTS hr_onboarding_employees;

CREATE TABLE hr_onboarding_employees (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  title          TEXT,
  dept           TEXT,
  mgr            TEXT,
  start          TEXT,                              -- 'YYYY-MM-DD' (matches app field)
  type           TEXT,
  status         TEXT NOT NULL DEFAULT 'active',    -- 'active' | 'completed'
  completed_date TEXT,
  color_idx      INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hr_onboarding_state (
  employee_id   UUID PRIMARY KEY REFERENCES hr_onboarding_employees(id) ON DELETE CASCADE,
  task_state    JSONB NOT NULL DEFAULT '{}'::jsonb,
  custom_tasks  JSONB NOT NULL DEFAULT '{}'::jsonb,
  skill_state   JSONB NOT NULL DEFAULT '{}'::jsonb,
  eval_state    JSONB NOT NULL DEFAULT '{}'::jsonb,
  custom_evals  JSONB NOT NULL DEFAULT '{}'::jsonb,
  doc_state     JSONB NOT NULL DEFAULT '{}'::jsonb,
  form_data     JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
