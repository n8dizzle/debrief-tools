-- Per-deal manual sub-step status (Phase 2). Auto sub-steps computed from ST signals;
-- only manual checkboxes stored. Keyed deal (project) × install_nodes sub-step id.
create table if not exists install_deal_steps (
  st_project_id bigint not null,
  node_id       uuid   not null,
  done          boolean not null default false,
  note          text,
  done_by       uuid,
  done_at       timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (st_project_id, node_id)
);
create index if not exists install_deal_steps_project_idx on install_deal_steps(st_project_id);
