-- rigor — 001_work_items.sql
--
-- Two tables, on purpose. Everything rigor does is "a thing moving through steps,
-- held by someone, with a record of what happened." parts-equipment's pe_orders has
-- 58 columns because it grew as a mirror of a spreadsheet; a flat row can't say
-- "two of these three parts are moving and one is stuck."
--
-- The DATA MODEL is generic. The PROCESS is hardcoded in code (lib/processes.ts),
-- not configured in a settings screen — that path was tried in parts-equipment and
-- abandoned as over-built. Adding a team's process means writing a file, not
-- teaching a manager an admin UI.

-- ── The thing being worked ────────────────────────────────────────────
create table if not exists rg_work_items (
  id            bigserial primary key,

  -- which process this item belongs to. 'parts' today; other teams later.
  process       text        not null,

  -- where the item came from, so a re-sync updates rather than duplicates.
  -- for parts: source='st_estimate_item', source_id = ServiceTitan line-item id
  -- (verified stable, and unique per line).
  source        text        not null,
  source_id     text        not null,

  -- position in the process. Values are validated in code against the process
  -- definition, deliberately not by a DB enum — steps change, migrations shouldn't.
  step          text        not null,

  -- who holds it RIGHT NOW. null = nobody has picked it up yet.
  -- This is the only "whose queue is it" signal. It is never guessed.
  owner_role    text,

  -- terminal state. Open items are what boards show. Closed items keep their
  -- history. Nothing closes itself — see the events table for why.
  closed_at     timestamptz,
  closed_reason text,

  -- process-specific fields live here rather than as 58 columns. For parts:
  -- job, customer, sku, description, qty, unit_cost, estimate_id, st_url, supplier,
  -- order_num, eta.
  data          jsonb       not null default '{}'::jsonb,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (source, source_id)
);

create index if not exists rg_work_items_open_idx
  on rg_work_items (process, step, owner_role) where closed_at is null;
create index if not exists rg_work_items_job_idx
  on rg_work_items ((data->>'job'));

-- ── What happened, append-only ────────────────────────────────────────
-- pe_orders can tell you a row is at "ordered". It cannot tell you who moved it
-- there, when, or what it was before. Every complaint tonight traced back to not
-- being able to answer that.
create table if not exists rg_events (
  id            bigserial primary key,
  work_item_id  bigint      not null references rg_work_items(id) on delete cascade,
  at            timestamptz not null default now(),

  -- who acted. 'sync' when the system did it, otherwise a portal_users email.
  actor         text        not null,

  -- 'created' | 'step' | 'assign' | 'edit' | 'close'
  kind          text        not null,
  from_value    text,
  to_value      text,
  note          text
);

create index if not exists rg_events_item_idx on rg_events (work_item_id, at desc);

-- RLS on with no policies, matching every other table in this project. All reads
-- and writes go through API routes using the secret key, which bypasses RLS; the
-- publishable key is in the browser bundle and must never reach these tables.
alter table rg_work_items enable row level security;
alter table rg_events     enable row level security;

create or replace function rg_touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists rg_work_items_updated_at on rg_work_items;
create trigger rg_work_items_updated_at
  before update on rg_work_items
  for each row execute function rg_touch_updated_at();
