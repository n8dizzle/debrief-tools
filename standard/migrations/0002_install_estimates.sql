-- All ServiceTitan estimates for an install's project (not just the one ap-payments
-- picks). One row per estimate id — this is what lets the Sold stage show every
-- estimate on a multi-system deal. Populated by /api/sync/estimates from ST.

create table if not exists install_estimates (
  estimate_id         bigint primary key,        -- ServiceTitan estimate id
  st_project_id       bigint,
  estimate_job_number text,                       -- the estimate's own job #
  name                text,
  status              text,                        -- Sold | Dismissed | Open | …
  sold_by_id          bigint,                      -- ST technician id
  sold_on             timestamptz,
  subtotal            numeric,                     -- ST "Total"
  tax                 numeric,
  total_cost          numeric,                     -- sum(unitCost × qty) across items
  equipment_count     int,                         -- count of Equipment-type line items
  items               jsonb,                       -- trimmed line items for display
  synced_at           timestamptz not null default now()
);
create index if not exists install_estimates_project_idx on install_estimates(st_project_id);
