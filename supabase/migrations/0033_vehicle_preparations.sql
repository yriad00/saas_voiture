create table if not exists public.vehicle_preparations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  reservation_id uuid references public.reservations(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
  status text not null default 'PENDING' check (status in ('PENDING','IN_PROGRESS','READY','BLOCKED')),
  vehicle_clean boolean not null default false,
  fuel_level_checked boolean not null default false,
  tires_checked boolean not null default false,
  documents_checked boolean not null default false,
  accessories_checked boolean not null default false,
  keys_count integer not null default 1 check (keys_count >= 0 and keys_count <= 10),
  photos_checked boolean not null default false,
  notes text,
  prepared_by uuid references auth.users(id) on delete set null,
  prepared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_preparation_parent_check check (reservation_id is not null or contract_id is not null),
  constraint vehicle_preparation_ready_check check (status <> 'READY' or (vehicle_clean and fuel_level_checked and tires_checked and documents_checked and accessories_checked and keys_count > 0 and photos_checked)),
  unique (contract_id)
);

create index if not exists vehicle_preparations_agency_branch_idx on public.vehicle_preparations (agency_id, branch_id, status);
create index if not exists vehicle_preparations_vehicle_idx on public.vehicle_preparations (vehicle_id, status);
create index if not exists vehicle_preparations_reservation_idx on public.vehicle_preparations (reservation_id);
create index if not exists vehicle_preparations_prepared_by_idx on public.vehicle_preparations (prepared_by);

create or replace function private.validate_vehicle_preparation_scope()
returns trigger language plpgsql security definer set search_path = public, private
as $$
declare v_agency uuid; v_branch uuid; p_agency uuid; p_branch uuid;
begin
  select agency_id, branch_id into v_agency, v_branch from public.vehicles where id = new.vehicle_id;
  if new.contract_id is not null then
    select agency_id, branch_id into p_agency, p_branch from public.contracts where id = new.contract_id;
  else
    select agency_id, branch_id into p_agency, p_branch from public.reservations where id = new.reservation_id;
  end if;
  if v_agency is null or p_agency is null or v_agency <> new.agency_id or p_agency <> new.agency_id or p_branch is distinct from new.branch_id or v_branch is distinct from new.branch_id then
    raise exception 'vehicle_preparation_scope_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists vehicle_preparations_scope on public.vehicle_preparations;
create trigger vehicle_preparations_scope before insert or update on public.vehicle_preparations for each row execute function private.validate_vehicle_preparation_scope();

alter table public.vehicle_preparations enable row level security;
grant select, insert, update, delete on public.vehicle_preparations to authenticated;
drop policy if exists vehicle_preparations_select on public.vehicle_preparations;
create policy vehicle_preparations_select on public.vehicle_preparations for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists vehicle_preparations_insert on public.vehicle_preparations;
create policy vehicle_preparations_insert on public.vehicle_preparations for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists vehicle_preparations_update on public.vehicle_preparations;
create policy vehicle_preparations_update on public.vehicle_preparations for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists vehicle_preparations_delete on public.vehicle_preparations;
create policy vehicle_preparations_delete on public.vehicle_preparations for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
