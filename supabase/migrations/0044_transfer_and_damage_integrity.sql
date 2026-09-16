create or replace function private.sync_transfer_vehicle() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if new.status = 'IN_TRANSIT' then
    update public.vehicles set status = 'OUT_OF_SERVICE', updated_at = now() where id = new.vehicle_id and agency_id = new.agency_id;
  elsif new.status = 'COMPLETED' then
    update public.vehicles set branch_id = new.to_branch_id, mileage = coalesce(new.mileage_arrival, mileage), status = 'AVAILABLE', updated_at = now() where id = new.vehicle_id and agency_id = new.agency_id;
  end if;
  return new;
end $$;
drop trigger if exists vehicle_transfer_vehicle_sync on public.vehicle_transfers;
create trigger vehicle_transfer_vehicle_sync after insert or update on public.vehicle_transfers for each row execute function private.sync_transfer_vehicle();

create or replace function private.prevent_rental_during_transfer() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if exists (select 1 from public.vehicle_transfers t where t.agency_id = new.agency_id and t.vehicle_id = new.vehicle_id and t.status = 'IN_TRANSIT') then
    raise exception 'vehicle_in_active_transfer' using errcode = '23P01';
  end if;
  return new;
end $$;
drop trigger if exists reservations_transfer_guard on public.reservations;
create trigger reservations_transfer_guard before insert or update on public.reservations for each row execute function private.prevent_rental_during_transfer();
drop trigger if exists contracts_transfer_guard on public.contracts;
create trigger contracts_transfer_guard before insert or update on public.contracts for each row execute function private.prevent_rental_during_transfer();

create or replace function private.sync_damage_vehicle() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if new.severity in ('MAJOR','CRITICAL') and new.status not in ('REPAIRED','CLOSED') then
    update public.vehicles set status = 'OUT_OF_SERVICE', updated_at = now() where id = new.vehicle_id and agency_id = new.agency_id;
  end if;
  return new;
end $$;
drop trigger if exists damage_vehicle_sync on public.damage_records;
create trigger damage_vehicle_sync after insert or update on public.damage_records for each row execute function private.sync_damage_vehicle();
