create table if not exists public.contract_checkouts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  checkout_at timestamptz not null default now(),
  mileage integer not null check (mileage >= 0),
  fuel_level integer not null check (fuel_level between 0 and 8),
  cleanliness text not null check (cleanliness in ('CLEAN','ACCEPTABLE','DIRTY')),
  accessories jsonb not null default '[]'::jsonb,
  keys_count integer not null default 1 check (keys_count between 0 and 10),
  signature_name text not null check (char_length(signature_name) between 2 and 160),
  signature_data text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id)
);

create index if not exists contract_checkouts_agency_branch_idx on public.contract_checkouts (agency_id, branch_id, checkout_at desc);
create index if not exists contract_checkouts_contract_idx on public.contract_checkouts (contract_id);
create index if not exists contract_checkouts_vehicle_idx on public.contract_checkouts (vehicle_id, checkout_at desc);
create index if not exists contract_checkouts_reservation_idx on public.contract_checkouts (reservation_id);
create index if not exists contract_checkouts_created_by_idx on public.contract_checkouts (created_by);

create or replace function private.validate_contract_checkout_scope()
returns trigger language plpgsql security definer set search_path = public, private
as $$
declare c_agency uuid; c_branch uuid; c_vehicle uuid; c_reservation uuid;
begin
  select agency_id, branch_id, vehicle_id, reservation_id into c_agency, c_branch, c_vehicle, c_reservation from public.contracts where id = new.contract_id;
  if c_agency is null or c_agency <> new.agency_id or c_branch is distinct from new.branch_id or c_vehicle <> new.vehicle_id or c_reservation is distinct from new.reservation_id then
    raise exception 'contract_checkout_scope_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists contract_checkouts_scope on public.contract_checkouts;
create trigger contract_checkouts_scope before insert or update on public.contract_checkouts for each row execute function private.validate_contract_checkout_scope();

alter table public.contract_checkouts enable row level security;
grant select, insert, update, delete on public.contract_checkouts to authenticated;
drop policy if exists contract_checkouts_select on public.contract_checkouts;
create policy contract_checkouts_select on public.contract_checkouts for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists contract_checkouts_insert on public.contract_checkouts;
create policy contract_checkouts_insert on public.contract_checkouts for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists contract_checkouts_update on public.contract_checkouts;
create policy contract_checkouts_update on public.contract_checkouts for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists contract_checkouts_delete on public.contract_checkouts;
create policy contract_checkouts_delete on public.contract_checkouts for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
