-- Estimate Debrief HVAC form submissions (ServiceTitan form 2709). Capture the whole
-- submission but surface only payment_type for now. Keyed by submission; st_project_id
-- resolved from the owner job (nullable = the ~8% of debrief jobs with no project).
create table if not exists install_debriefs (
  submission_id  bigint primary key,
  form_id        bigint not null,
  st_project_id  bigint,
  owner_job_id   bigint,
  status         text,
  submitted_on   timestamptz,
  payment_type   text[] not null default '{}',
  fields         jsonb,
  synced_at      timestamptz not null default now()
);
create index if not exists install_debriefs_project_idx on install_debriefs(st_project_id);
create index if not exists install_debriefs_job_idx on install_debriefs(owner_job_id);
