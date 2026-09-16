create table if not exists public.vehicle_swaps (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  old_vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  new_vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  reason text not null check (char_length(reason) between 2 and 1000),
  old_mileage integer check (old_mileage is null or old_mileage >= 0),
  new_mileage integer check (new_mileage is null or new_mileage >= 0),
  fuel_level integer check (fuel_level is null or fuel_level between 0 and 8),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint vehicle_swaps_different check (old_vehicle_id <> new_vehicle_id)
);

create index if not exists vehicle_swaps_agency_branch_idx on public.vehicle_swaps (agency_id, branch_id, created_at desc);
create index if not exists vehicle_swaps_contract_idx on public.vehicle_swaps (contract_id, created_at desc);
create index if not exists vehicle_swaps_old_vehicle_idx on public.vehicle_swaps (old_vehicle_id, created_at desc);
create index if not exists vehicle_swaps_new_vehicle_idx on public.vehicle_swaps (new_vehicle_id, created_at desc);
create index if not exists vehicle_swaps_created_by_idx on public.vehicle_swaps (created_by);
create index if not exists vehicle_swaps_branch_id_idx on public.vehicle_swaps (branch_id);

alter table public.vehicle_swaps enable row level security;
grant select, insert on public.vehicle_swaps to authenticated;
drop policy if exists vehicle_swaps_select on public.vehicle_swaps;
create policy vehicle_swaps_select on public.vehicle_swaps for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists vehicle_swaps_insert on public.vehicle_swaps;
create policy vehicle_swaps_insert on public.vehicle_swaps for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and created_by = auth.uid()));
