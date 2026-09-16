create table if not exists public.active_rental_updates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  event_type text not null check (event_type in ('MILEAGE','CUSTOMER_CONTACT','GPS_ALERT','DAMAGE_REPORT','OTHER')),
  occurred_at timestamptz not null default now(),
  mileage integer check (mileage is null or mileage >= 0),
  fuel_level integer check (fuel_level is null or fuel_level between 0 and 8),
  location text,
  notes text not null check (char_length(notes) between 2 and 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists active_rental_updates_agency_branch_idx on public.active_rental_updates (agency_id, branch_id, occurred_at desc);
create index if not exists active_rental_updates_contract_idx on public.active_rental_updates (contract_id, occurred_at desc);
create index if not exists active_rental_updates_vehicle_idx on public.active_rental_updates (vehicle_id, occurred_at desc);
create index if not exists active_rental_updates_created_by_idx on public.active_rental_updates (created_by);

create or replace function private.validate_active_rental_update_scope()
returns trigger language plpgsql security definer set search_path = public, private
as $$
declare c_agency uuid; c_branch uuid; c_vehicle uuid;
begin
  select agency_id, branch_id, vehicle_id into c_agency, c_branch, c_vehicle from public.contracts where id = new.contract_id;
  if c_agency is null or c_agency <> new.agency_id or c_branch is distinct from new.branch_id or c_vehicle <> new.vehicle_id then
    raise exception 'active_rental_update_scope_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists active_rental_updates_scope on public.active_rental_updates;
create trigger active_rental_updates_scope before insert or update on public.active_rental_updates for each row execute function private.validate_active_rental_update_scope();

alter table public.active_rental_updates enable row level security;
grant select, insert, update, delete on public.active_rental_updates to authenticated;
drop policy if exists active_rental_updates_select on public.active_rental_updates;
create policy active_rental_updates_select on public.active_rental_updates for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists active_rental_updates_insert on public.active_rental_updates;
create policy active_rental_updates_insert on public.active_rental_updates for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists active_rental_updates_update on public.active_rental_updates;
create policy active_rental_updates_update on public.active_rental_updates for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists active_rental_updates_delete on public.active_rental_updates;
create policy active_rental_updates_delete on public.active_rental_updates for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
