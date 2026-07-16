-- Rung 2: the install map lives in the database.
-- Self-referencing tree. depth: 0 = stage, 1 = sub-step, 2 = detail (cap at 2).
-- `status` is nullable and illustrative for now; ServiceTitan drives it in Phase 2.
-- Soft-delete via is_archived so nothing is ever lost while the map is being learned.

create table if not exists install_nodes (
  id               uuid primary key default gen_random_uuid(),
  parent_id        uuid references install_nodes(id) on delete cascade,
  depth            int  not null default 0,
  title            text not null,
  sort_order       int  not null default 0,
  status           text,               -- 'done'|'active'|'wait'|'blocked'|null
  summary          text,               -- one-line description (stage level)
  owner            text,               -- who owns this stage today
  tools            text,               -- tools the work lives in today
  typical_duration text,               -- typical elapsed time
  what_goes_wrong  text,               -- risk note
  notes            text,               -- free-form / sub-step detail line
  is_archived      boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists install_nodes_parent_idx on install_nodes(parent_id);
create index if not exists install_nodes_active_idx  on install_nodes(is_archived, depth, sort_order);

-- Seed the 7 stages (only if the table is empty — safe to re-run).
insert into install_nodes (title, depth, sort_order, status, summary, owner, tools, typical_duration, what_goes_wrong)
select v.title, 0, v.ord, v.status, v.summary, v.owner, v.tools, v.duration, v.risk
from (values
  ('Sold', 0, 'done', 'Deal is closed and the job is real. Money and paperwork land before anything moves.',
   'Comfort Advisor → hands to Coordinator', 'ServiceTitan, estimate-tool, financing portal', 'same day',
   'Deposit not collected or contract unsigned — job looks "in flight" but is not funded.'),
  ('Permit', 1, 'blocked', 'Some jobs need a city permit before install. ServiceTitan does not track this.',
   'Install Coordinator', 'City portals (each city differs), email, phone', '2–10 days',
   'Crew shows up before the permit clears. Illegal to start; truck roll wasted.'),
  ('Equipment', 2, 'active', 'The right units and parts are ordered, delivered, and staged for the crew.',
   'Purchasing / Warehouse', 'Supplier portals, POs, warehouse whiteboard', '1–14 days',
   'Wrong or backordered equipment found on install day. Reschedule, unhappy customer.'),
  ('Scheduled', 3, 'wait', 'Crew, date, and customer are locked in — once permit + equipment are ready.',
   'Install Coordinator', 'ServiceTitan dispatch board', '—',
   'Scheduled before prerequisites are met, so the day collapses at the last minute.'),
  ('Installed', 4, 'wait', 'The work: old system out, new system in, started up, customer walked through it.',
   'Install Crew / Lead', 'ServiceTitan mobile, photos', '1–3 days',
   'Incomplete startup or missing photos — comes back as a callback later.'),
  ('Inspection', 5, 'wait', 'Permitted jobs get a city inspection. A fail means a return trip and re-inspection.',
   'City Inspector (Coordinator schedules)', 'City portals, phone', '3–14 days',
   'Inspection failed or never scheduled — job silently sits "almost done" for weeks.'),
  ('Closed / Paid', 6, 'wait', 'Final money in, warranties registered, contractor paid, job truly done.',
   'Office / AP', 'ServiceTitan, ap-payments, warranty registration', '1–7 days',
   'Balance uncollected or warranty never registered — margin leaks, customer unprotected.')
) as v(title, ord, status, summary, owner, tools, duration, risk)
where not exists (select 1 from install_nodes);

-- Seed sub-steps as children (matched to their stage by title).
insert into install_nodes (parent_id, title, depth, sort_order, notes)
select p.id, s.title, 1, s.ord, s.detail
from (values
  ('Sold','Contract signed',0,'customer accepts the proposal'),
  ('Sold','Deposit collected',1,'or financing approved'),
  ('Sold','Job created in ServiceTitan',2,'becomes the system of record'),
  ('Sold','Handoff to install coordinator',3,'the baton pass that gets fumbled'),
  ('Permit','Determine if permit needed',0,'depends on scope & city'),
  ('Permit','Submit application',1,'portal or in person'),
  ('Permit','Permit approved',2,'the gate that blocks scheduling'),
  ('Equipment','Equipment ordered',0,'PO to supplier'),
  ('Equipment','PO confirmed',1,'ship date known'),
  ('Equipment','Delivered & staged',2,'ready for the truck'),
  ('Scheduled','Crew assigned',0,'right size & skill'),
  ('Scheduled','Install date set',1,'on the dispatch board'),
  ('Scheduled','Customer confirmed',2,'the day-before call'),
  ('Installed','Crew on site',0,'job in progress'),
  ('Installed','System installed',1,'old out / new in'),
  ('Installed','Startup & commissioning',2,'verify it runs right'),
  ('Installed','Customer walkthrough',3,'teach the thermostat'),
  ('Inspection','Inspection scheduled',0,'with the city'),
  ('Inspection','Inspection passed',1,'or corrections + re-inspect'),
  ('Closed / Paid','Final invoice sent',0,'balance due'),
  ('Closed / Paid','Balance collected',1,'money in'),
  ('Closed / Paid','Warranty registered',2,'manufacturer + membership'),
  ('Closed / Paid','Contractor pay run',3,'closes in ap-payments')
) as s(stage, title, ord, detail)
join install_nodes p on p.title = s.stage and p.depth = 0
where not exists (select 1 from install_nodes where depth = 1);
