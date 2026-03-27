-- Install Tracker Migration
-- Creates tables for order tracking, contractor management, and magic link authentication

-- ============================================================================
-- CONTRACTORS TABLE
-- ============================================================================
create table if not exists public.contractors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text,
  phone text unique not null,
  email text,
  logo_url text,
  is_internal boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.contractors is 'Service providers who perform installations and repairs';
comment on column public.contractors.is_internal is 'Flag for internal company contractors (your own team)';

-- RLS for contractors
alter table public.contractors enable row level security;

-- Contractors are publicly readable (for homeowner views)
create policy "Contractors are viewable by authenticated users"
  on public.contractors for select
  to authenticated
  using (true);

-- Only service role can modify contractors
create policy "Service role can manage contractors"
  on public.contractors for all
  to service_role
  using (true);

-- ============================================================================
-- SERVICE TYPES TABLE
-- ============================================================================
create table if not exists public.service_types (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  icon text,
  created_at timestamptz default now()
);

comment on table public.service_types is 'Types of services offered (hvac_install, plumbing_repair, etc.)';

-- RLS for service_types
alter table public.service_types enable row level security;

-- Service types are publicly readable
create policy "Service types are viewable by everyone"
  on public.service_types for select
  to authenticated
  using (true);

-- ============================================================================
-- STAGE TEMPLATES TABLE
-- ============================================================================
create table if not exists public.stage_templates (
  id uuid primary key default gen_random_uuid(),
  service_type_id uuid references public.service_types(id) on delete cascade,
  name text not null,
  is_default boolean default false,
  created_at timestamptz default now()
);

comment on table public.stage_templates is 'Templates defining the stages for a type of service';

-- RLS for stage_templates
alter table public.stage_templates enable row level security;

create policy "Stage templates are viewable by authenticated users"
  on public.stage_templates for select
  to authenticated
  using (true);

-- ============================================================================
-- STAGE TEMPLATE ITEMS TABLE
-- ============================================================================
create table if not exists public.stage_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.stage_templates(id) on delete cascade not null,
  position smallint not null,
  name text not null,
  description text,
  educational_content jsonb,
  icon text,
  typical_duration_hours int,
  unique (template_id, position)
);

comment on table public.stage_template_items is 'Individual stages within a stage template';
comment on column public.stage_template_items.educational_content is 'JSON with title, description, tips for homeowner education';

-- RLS for stage_template_items
alter table public.stage_template_items enable row level security;

create policy "Stage template items are viewable by authenticated users"
  on public.stage_template_items for select
  to authenticated
  using (true);

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  homeowner_id uuid references auth.users(id) not null,
  home_id uuid references public.homes(id),
  contractor_id uuid references public.contractors(id),
  service_type_id uuid references public.service_types(id) not null,

  order_number text unique not null,
  status text not null default 'pending',

  -- Pricing
  product_tier text,
  product_brand text,
  product_model text,
  base_price numeric(10,2),
  addons_total numeric(10,2) default 0,
  deposit_amount numeric(10,2),
  total_amount numeric(10,2),

  -- Scheduling
  scheduled_date date,
  scheduled_time_slot text,

  -- Contact info (denormalized for easy access)
  customer_name text,
  customer_phone text,
  customer_email text,
  customer_address text,

  -- Tracking
  current_stage_position smallint default 1,
  stage_template_id uuid references public.stage_templates(id),

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  completed_at timestamptz
);

comment on table public.orders is 'Customer orders for services';
comment on column public.orders.order_number is 'Human-readable order number (HW-XXXXXX)';
comment on column public.orders.status is 'Order status: pending, confirmed, in_progress, completed, cancelled';

-- Indexes for orders
create index idx_orders_homeowner_id on public.orders(homeowner_id);
create index idx_orders_contractor_id on public.orders(contractor_id);
create index idx_orders_status on public.orders(status);
create index idx_orders_order_number on public.orders(order_number);

-- RLS for orders
alter table public.orders enable row level security;

-- Homeowners can view their own orders
create policy "Homeowners can view their own orders"
  on public.orders for select
  to authenticated
  using (homeowner_id = auth.uid());

-- Homeowners can create orders for themselves
create policy "Homeowners can create their own orders"
  on public.orders for insert
  to authenticated
  with check (homeowner_id = auth.uid());

-- Service role can manage all orders (for contractor API routes)
create policy "Service role can manage all orders"
  on public.orders for all
  to service_role
  using (true);

-- ============================================================================
-- ORDER STAGES TABLE
-- ============================================================================
create table if not exists public.order_stages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade not null,
  position smallint not null,
  name text not null,
  description text,
  educational_content jsonb,
  icon text,
  status text not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  contractor_note text,
  unique (order_id, position)
);

comment on table public.order_stages is 'Actual stages for a specific order (copied from template)';
comment on column public.order_stages.status is 'Stage status: pending, current, completed';

-- Indexes for order_stages
create index idx_order_stages_order_id on public.order_stages(order_id);
create index idx_order_stages_status on public.order_stages(status);

-- RLS for order_stages
alter table public.order_stages enable row level security;

-- Homeowners can view stages for their orders
create policy "Homeowners can view their order stages"
  on public.order_stages for select
  to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_stages.order_id
      and orders.homeowner_id = auth.uid()
    )
  );

-- Service role can manage all order stages
create policy "Service role can manage all order stages"
  on public.order_stages for all
  to service_role
  using (true);

-- Enable realtime for order_stages
alter publication supabase_realtime add table public.order_stages;

-- ============================================================================
-- CONTRACTOR MAGIC LINKS TABLE
-- ============================================================================
create table if not exists public.contractor_magic_links (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid references public.contractors(id) not null,
  order_id uuid references public.orders(id) on delete cascade not null,
  token text unique not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now()
);

comment on table public.contractor_magic_links is 'Temporary tokens for contractor access without login';
comment on column public.contractor_magic_links.token is 'Unique token sent via SMS to contractor';

-- Indexes for magic links
create index idx_contractor_magic_links_token on public.contractor_magic_links(token);
create index idx_contractor_magic_links_order_id on public.contractor_magic_links(order_id);

-- RLS for contractor_magic_links
alter table public.contractor_magic_links enable row level security;

-- Only service role can manage magic links
create policy "Service role can manage magic links"
  on public.contractor_magic_links for all
  to service_role
  using (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to generate order number
create or replace function generate_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := 'HW-';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- Function to copy stages from template to order
create or replace function copy_stages_to_order(
  p_order_id uuid,
  p_template_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.order_stages (order_id, position, name, description, educational_content, icon, status)
  select
    p_order_id,
    position,
    name,
    description,
    educational_content,
    icon,
    case when position = 1 then 'current' else 'pending' end
  from public.stage_template_items
  where template_id = p_template_id
  order by position;
end;
$$;

-- Function to advance order to next stage
create or replace function advance_order_stage(
  p_order_id uuid,
  p_contractor_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_position smallint;
  v_max_position smallint;
  v_current_stage_id uuid;
  v_next_stage_id uuid;
begin
  -- Get current stage position
  select current_stage_position into v_current_position
  from public.orders
  where id = p_order_id;

  if v_current_position is null then
    return jsonb_build_object('success', false, 'error', 'Order not found');
  end if;

  -- Get max position for this order
  select max(position) into v_max_position
  from public.order_stages
  where order_id = p_order_id;

  -- Get current stage ID
  select id into v_current_stage_id
  from public.order_stages
  where order_id = p_order_id and position = v_current_position;

  -- Mark current stage as completed
  update public.order_stages
  set
    status = 'completed',
    completed_at = now(),
    contractor_note = coalesce(p_contractor_note, contractor_note)
  where id = v_current_stage_id;

  -- If there's a next stage, make it current
  if v_current_position < v_max_position then
    select id into v_next_stage_id
    from public.order_stages
    where order_id = p_order_id and position = v_current_position + 1;

    update public.order_stages
    set
      status = 'current',
      started_at = now()
    where id = v_next_stage_id;

    update public.orders
    set
      current_stage_position = v_current_position + 1,
      updated_at = now()
    where id = p_order_id;

    return jsonb_build_object(
      'success', true,
      'new_position', v_current_position + 1,
      'is_complete', false
    );
  else
    -- Order is complete
    update public.orders
    set
      status = 'completed',
      completed_at = now(),
      updated_at = now()
    where id = p_order_id;

    return jsonb_build_object(
      'success', true,
      'new_position', v_current_position,
      'is_complete', true
    );
  end if;
end;
$$;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Service Types
insert into public.service_types (slug, name, description, icon) values
  ('hvac_install', 'HVAC Installation', 'Full HVAC system installation or replacement', 'thermometer'),
  ('hvac_repair', 'HVAC Repair', 'HVAC system repair and troubleshooting', 'wrench'),
  ('hvac_maintenance', 'HVAC Maintenance', 'Routine HVAC maintenance and tune-up', 'settings'),
  ('plumbing_repair', 'Plumbing Repair', 'Plumbing repair services', 'droplet'),
  ('electrical_repair', 'Electrical Repair', 'Electrical system repair', 'zap')
on conflict (slug) do nothing;

-- HVAC Install Stage Template
insert into public.stage_templates (id, service_type_id, name, is_default)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  id,
  'Standard HVAC Installation',
  true
from public.service_types
where slug = 'hvac_install'
on conflict do nothing;

-- HVAC Install Stage Template Items
insert into public.stage_template_items (template_id, position, name, description, educational_content, icon, typical_duration_hours) values
(
  '00000000-0000-0000-0000-000000000001',
  1,
  'Order Confirmed',
  'Your order has been received and confirmed.',
  '{"title": "What happens next?", "description": "We''re processing your order and will begin coordinating with our installation team.", "tips": ["You''ll receive email confirmation shortly", "Keep your phone handy for scheduling calls", "Review your order details in the app anytime"]}'::jsonb,
  'check-circle',
  1
),
(
  '00000000-0000-0000-0000-000000000001',
  2,
  'Equipment Ordered',
  'Your new HVAC equipment has been ordered from the manufacturer.',
  '{"title": "Your equipment is on the way", "description": "We''ve placed the order for your specific system. Equipment typically arrives within 3-5 business days.", "tips": ["Your system is ordered to your home''s exact specifications", "We order directly from manufacturers for best quality", "Equipment is inspected before delivery"]}'::jsonb,
  'package',
  72
),
(
  '00000000-0000-0000-0000-000000000001',
  3,
  'Scheduling Install',
  'Our team will contact you to schedule your installation date.',
  '{"title": "Let''s find the perfect time", "description": "An installation coordinator will call within 24 hours to schedule your install at a time that works for you.", "tips": ["Installations typically take 4-8 hours", "Someone 18+ must be home during install", "Consider scheduling for a day you''re home"]}'::jsonb,
  'calendar',
  24
),
(
  '00000000-0000-0000-0000-000000000001',
  4,
  'Day of Install',
  'Installation day is here. Our team is preparing to arrive.',
  '{"title": "Installation day checklist", "description": "Here''s what to expect and how to prepare for a smooth installation.", "tips": ["Clear 3 feet around indoor and outdoor units", "Ensure easy access to electrical panel", "Secure pets in a safe area", "The team will call 30 min before arrival"]}'::jsonb,
  'truck',
  2
),
(
  '00000000-0000-0000-0000-000000000001',
  5,
  'Installation In Progress',
  'Our technicians are actively installing your new system.',
  '{"title": "Work in progress", "description": "Our certified technicians are carefully installing your new HVAC system. This typically takes 4-8 hours depending on system complexity.", "tips": ["Feel free to ask questions anytime", "Technicians will show you the work as they go", "Power may be briefly interrupted", "Stay hydrated - no AC during install"]}'::jsonb,
  'wrench',
  6
),
(
  '00000000-0000-0000-0000-000000000001',
  6,
  'Quality Check',
  'Final inspection and testing of your new system.',
  '{"title": "Making sure everything is perfect", "description": "Our team is running comprehensive tests to ensure your system operates at peak efficiency.", "tips": ["We test heating and cooling modes", "Airflow is measured at every vent", "Refrigerant levels are verified", "All electrical connections are inspected"]}'::jsonb,
  'clipboard-check',
  1
),
(
  '00000000-0000-0000-0000-000000000001',
  7,
  'Complete',
  'Installation complete. Enjoy your new HVAC system.',
  '{"title": "You''re all set", "description": "Your new HVAC system is installed and ready to keep you comfortable year-round.", "tips": ["Register your warranty within 30 days", "Schedule your first maintenance in 6 months", "Change filters every 1-3 months", "Save 10-15% by using a programmable thermostat"]}'::jsonb,
  'home',
  0
)
on conflict do nothing;

-- Internal Contractor (Homework's own team)
insert into public.contractors (id, name, company_name, phone, email, is_internal) values
(
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Homework Installation Team',
  'Homework',
  '+15555550000',
  'installs@homework.com',
  true
)
on conflict do nothing;

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

-- Trigger function for updated_at
create or replace function update_updated_at_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply trigger to contractors
create trigger set_contractors_updated_at
  before update on public.contractors
  for each row
  execute function update_updated_at_column();

-- Apply trigger to orders
create trigger set_orders_updated_at
  before update on public.orders
  for each row
  execute function update_updated_at_column();
