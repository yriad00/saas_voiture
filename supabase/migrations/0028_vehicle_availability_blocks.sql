create table if not exists public.vehicle_blocks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  block_type text not null check (block_type in ('MAINTENANCE', 'ADMIN', 'TRANSFER', 'DAMAGE')),
  reason text not null check (char_length(reason) between 2 and 500),
  start_date date not null,
  end_date date not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'CANCELLED')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_blocks_valid_range check (end_date >= start_date)
);

create index if not exists vehicle_blocks_vehicle_dates_idx
  on public.vehicle_blocks (agency_id, vehicle_id, start_date, end_date)
  where status = 'ACTIVE';
create index if not exists vehicle_blocks_branch_id_idx on public.vehicle_blocks (branch_id);
create index if not exists vehicle_blocks_created_by_idx on public.vehicle_blocks (created_by);

alter table public.vehicle_blocks enable row level security;
grant select, insert, update, delete on public.vehicle_blocks to authenticated;

drop policy if exists vehicle_blocks_select on public.vehicle_blocks;
create policy vehicle_blocks_select on public.vehicle_blocks
  for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists vehicle_blocks_insert on public.vehicle_blocks;
create policy vehicle_blocks_insert on public.vehicle_blocks
  for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'fleet:write')));
drop policy if exists vehicle_blocks_update on public.vehicle_blocks;
create policy vehicle_blocks_update on public.vehicle_blocks
  for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'fleet:write')))
  with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'fleet:write')));
drop policy if exists vehicle_blocks_delete on public.vehicle_blocks;
create policy vehicle_blocks_delete on public.vehicle_blocks
  for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'fleet:write')));

create or replace function private.prevent_vehicle_unavailability_overlap()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  requested_range daterange;
begin
  if TG_TABLE_NAME = 'reservations' then
    if new.status not in ('PENDING', 'CONFIRMED', 'ONGOING') then
      return new;
    end if;
    requested_range := daterange(new.start_date, case when new.end_date = new.start_date then new.end_date + 1 else new.end_date end, '[)');
    perform pg_advisory_xact_lock(hashtextextended(new.vehicle_id::text, 0));
    if exists (
      select 1 from public.vehicle_blocks b
      where b.agency_id = new.agency_id
        and b.vehicle_id = new.vehicle_id
        and b.status = 'ACTIVE'
        and daterange(b.start_date, case when b.end_date = b.start_date then b.end_date + 1 else b.end_date end, '[)') && requested_range
    ) then
      raise exception 'vehicle_unavailable_during_block';
    end if;
    return new;
  end if;

  requested_range := daterange(new.start_date, case when new.end_date = new.start_date then new.end_date + 1 else new.end_date end, '[)');
  if new.status = 'ACTIVE' then
    perform pg_advisory_xact_lock(hashtextextended(new.vehicle_id::text, 0));
    if exists (
      select 1 from public.reservations r
      where r.agency_id = new.agency_id
        and r.vehicle_id = new.vehicle_id
        and r.status in ('PENDING', 'CONFIRMED', 'ONGOING')
        and daterange(r.start_date, case when r.end_date = r.start_date then r.end_date + 1 else r.end_date end, '[)') && requested_range
    ) then
      raise exception 'vehicle_has_active_reservation';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_vehicle_unavailability_overlap() from public;
grant execute on function private.prevent_vehicle_unavailability_overlap() to authenticated;

drop trigger if exists reservations_block_overlap on public.reservations;
create trigger reservations_block_overlap
  before insert or update of agency_id, vehicle_id, start_date, end_date, status on public.reservations
  for each row execute function private.prevent_vehicle_unavailability_overlap();

drop trigger if exists vehicle_blocks_reservation_overlap on public.vehicle_blocks;
create trigger vehicle_blocks_reservation_overlap
  before insert or update of agency_id, vehicle_id, start_date, end_date, status on public.vehicle_blocks
  for each row execute function private.prevent_vehicle_unavailability_overlap();
