create or replace function private.validate_checkin_integrity() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare checkout_mileage integer;
begin
  select coalesce((select mileage from public.contract_checkouts where contract_id = new.contract_id), c.start_mileage) into checkout_mileage from public.contracts c where c.id = new.contract_id;
  if checkout_mileage is not null and new.return_mileage < checkout_mileage then raise exception 'return_mileage_below_checkout' using errcode='23514'; end if;
  if tg_op = 'UPDATE' and old.status = 'FINALIZED' and (new.status <> 'FINALIZED' or new.return_mileage <> old.return_mileage or new.fuel_level <> old.fuel_level) then raise exception 'finalized_checkin_immutable' using errcode='23514'; end if;
  return new;
end $$;
drop trigger if exists contract_checkins_integrity on public.contract_checkins;
create trigger contract_checkins_integrity before insert or update on public.contract_checkins for each row execute function private.validate_checkin_integrity();
