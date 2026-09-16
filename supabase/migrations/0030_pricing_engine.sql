create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete restrict,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  category text,
  name text not null check (char_length(name) between 2 and 160),
  daily_rate numeric(14,2) not null check (daily_rate >= 0),
  weekly_rate numeric(14,2) not null check (weekly_rate >= 0),
  monthly_rate numeric(14,2) not null check (monthly_rate >= 0),
  minimum_daily_rate numeric(14,2) not null check (minimum_daily_rate >= 0),
  valid_from date,
  valid_to date,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_rules_valid_range check (valid_to is null or valid_from is null or valid_to >= valid_from),
  constraint pricing_rules_scope check (vehicle_id is not null or category is not null or branch_id is not null or agency_id is not null)
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete restrict,
  code text not null,
  name text not null check (char_length(name) between 2 and 160),
  discount_type text not null check (discount_type in ('PERCENT', 'FIXED')),
  discount_value numeric(14,2) not null check (discount_value >= 0),
  minimum_days integer not null default 1 check (minimum_days >= 1),
  valid_from date not null,
  valid_to date not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, code),
  constraint promotions_valid_range check (valid_to >= valid_from),
  constraint promotions_percent_max check (discount_type <> 'PERCENT' or discount_value <= 100)
);

create index if not exists pricing_rules_lookup_idx on public.pricing_rules (agency_id, branch_id, category, vehicle_id, valid_from, valid_to) where active;
create index if not exists pricing_rules_vehicle_id_idx on public.pricing_rules (vehicle_id);
create index if not exists pricing_rules_branch_id_idx on public.pricing_rules (branch_id);
create index if not exists pricing_rules_created_by_idx on public.pricing_rules (created_by);
create index if not exists promotions_lookup_idx on public.promotions (agency_id, branch_id, valid_from, valid_to) where active;
create index if not exists promotions_branch_id_idx on public.promotions (branch_id);
create index if not exists promotions_created_by_idx on public.promotions (created_by);

alter table public.pricing_rules enable row level security;
alter table public.promotions enable row level security;
grant select, insert, update, delete on public.pricing_rules, public.promotions to authenticated;

drop policy if exists pricing_rules_select on public.pricing_rules;
create policy pricing_rules_select on public.pricing_rules for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists pricing_rules_insert on public.pricing_rules;
create policy pricing_rules_insert on public.pricing_rules for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists pricing_rules_update on public.pricing_rules;
create policy pricing_rules_update on public.pricing_rules for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists pricing_rules_delete on public.pricing_rules;
create policy pricing_rules_delete on public.pricing_rules for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));

drop policy if exists promotions_select on public.promotions;
create policy promotions_select on public.promotions for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists promotions_insert on public.promotions;
create policy promotions_insert on public.promotions for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists promotions_update on public.promotions;
create policy promotions_update on public.promotions for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists promotions_delete on public.promotions;
create policy promotions_delete on public.promotions for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
