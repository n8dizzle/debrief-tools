-- The deal (= ServiceTitan project) is the unit of the install pipeline. Ingested
-- independently from ST sold estimates — no reliance on ap_install_jobs. Every deal
-- lands as 'untriaged'; a manager dispatches it to the install pipeline or archives it.
create table if not exists install_deals (
  st_project_id       bigint primary key,
  triage_status       text not null default 'untriaged',   -- untriaged | install | archived
  suggested_class     text,                                  -- install | other
  suggestion_reason   text,
  customer_id         bigint,
  customer_name       text,
  primary_business_unit text,
  sold_on             date,
  sold_estimate_count int  default 0,
  equipment_unit_count int default 0,
  contract_total      numeric,
  install_job_number  text,
  install_job_status  text,
  completed_date      date,
  triaged_by          uuid,
  triaged_at          timestamptz,
  first_seen_at       timestamptz not null default now(),
  synced_at           timestamptz not null default now()
);
create index if not exists install_deals_triage_idx on install_deals(triage_status);
create index if not exists install_deals_suggested_idx on install_deals(suggested_class);
