create or replace function private.validate_checkin_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare checkout_mileage integer;
begin
  select coalesce((select mileage from public.contract_checkouts where contract_id = new.contract_id), c.start_mileage)
    into checkout_mileage from public.contracts c where c.id = new.contract_id;
  if checkout_mileage is not null and new.return_mileage < checkout_mileage then
    raise exception 'return_mileage_below_checkout' using errcode='23514';
  end if;
  if tg_op = 'UPDATE' and old.status = 'FINALIZED' then
    if new.status is distinct from old.status
      or new.actual_return_at is distinct from old.actual_return_at
      or new.return_mileage is distinct from old.return_mileage
      or new.fuel_level is distinct from old.fuel_level
      or new.cleanliness is distinct from old.cleanliness
      or new.exterior_condition is distinct from old.exterior_condition
      or new.interior_condition is distinct from old.interior_condition
      or new.missing_items is distinct from old.missing_items
      or new.notes is distinct from old.notes
      or new.signature_name is distinct from old.signature_name
      or new.signature_data is distinct from old.signature_data
      or new.finalized_at is distinct from old.finalized_at
      or new.finalized_by is distinct from old.finalized_by then
      raise exception 'finalized_checkin_immutable' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
