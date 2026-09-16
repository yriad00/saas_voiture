-- vehicle_blocks has date-only columns; keep its trigger path compatible with
-- the timestamp-aware reservation/contract trigger.
create or replace function private.prevent_vehicle_unavailability_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  requested_range tstzrange;
begin
  if TG_TABLE_NAME = 'reservations' then
    if new.vehicle_id is null or new.status not in ('PENDING', 'CONFIRMED', 'ONGOING') then
      return new;
    end if;
    requested_range := private.rental_period(new.start_date, new.end_date, new.pickup_at, new.return_at);
    perform pg_advisory_xact_lock(hashtextextended(new.vehicle_id::text, 0));
    if exists (
      select 1 from public.vehicle_blocks b
      where b.agency_id = new.agency_id
        and b.vehicle_id = new.vehicle_id
        and b.status = 'ACTIVE'
        and private.rental_period(b.start_date, b.end_date, null, null) && requested_range
    ) then
      raise exception 'vehicle_unavailable_during_block';
    end if;
    return new;
  end if;

  if new.vehicle_id is null or new.status <> 'ACTIVE' then return new; end if;
  if TG_TABLE_NAME = 'vehicle_blocks' then
    requested_range := private.rental_period(new.start_date, new.end_date, null, null);
  else
    requested_range := private.rental_period(new.start_date, new.end_date, new.start_at, new.end_at);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.vehicle_id::text, 0));
  if exists (
    select 1 from public.reservations r
    where r.agency_id = new.agency_id
      and r.vehicle_id = new.vehicle_id
      and r.status in ('PENDING', 'CONFIRMED', 'ONGOING')
      and private.rental_period(r.start_date, r.end_date, r.pickup_at, r.return_at) && requested_range
  ) then
    raise exception 'vehicle_has_active_reservation';
  end if;
  return new;
end;
$$;
