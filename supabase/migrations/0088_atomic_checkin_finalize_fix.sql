-- Finalize a return inspection in one database transaction.
-- The server action still records a REVIEW draft first so a failed upload or
-- retry never loses the employee's data. This function owns the irreversible
-- finalization boundary and rolls back every write if any validation/write
-- fails.

create or replace function public.finalize_contract_checkin(
  p_agency_id uuid,
  p_contract_id uuid,
  p_branch_id uuid,
  p_actual_return_at timestamptz,
  p_return_mileage integer,
  p_fuel_level integer,
  p_cleanliness text,
  p_exterior_condition text default null,
  p_interior_condition text default null,
  p_missing_items jsonb default '[]'::jsonb,
  p_notes text default null,
  p_signature_name text default null,
  p_signature_data text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor uuid := auth.uid();
  contract_row public.contracts%rowtype;
  checkin_row public.contract_checkins%rowtype;
  inspection_row public.contract_inspections%rowtype;
  checkout_mileage integer;
  late_hours integer;
  late_days integer;
  driven_mileage integer;
  extra_mileage integer;
  fuel_delta integer;
  v_finalized_at timestamptz := now();
  required_photo_count integer;
  automatic_total numeric := 0;
  manager_can_change_return_branch boolean := false;
begin
  if actor is null
     or not public.is_agency_member(p_agency_id)
     or not public.user_has_permission(p_agency_id, 'contracts.update') then
    raise exception 'checkin_permission_denied' using errcode = '42501';
  end if;

  if p_return_mileage < 0 then
    raise exception 'return_mileage_invalid' using errcode = '22003';
  end if;
  if p_fuel_level < 0 or p_fuel_level > 8 then
    raise exception 'return_fuel_invalid' using errcode = '22003';
  end if;
  if p_cleanliness not in ('CLEAN', 'ACCEPTABLE', 'DIRTY') then
    raise exception 'return_cleanliness_invalid' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_signature_name, '')), '') is null then
    raise exception 'return_signature_required' using errcode = '22023';
  end if;

  -- Serialize competing finalization attempts for the same contract.
  select * into contract_row
    from public.contracts
   where id = p_contract_id
     and agency_id = p_agency_id
   for update;
  if not found then
    raise exception 'contract_not_found' using errcode = '23503';
  end if;
  if contract_row.status <> 'ACTIVE' then
    raise exception 'contract_not_active' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.branches b
     where b.id = p_branch_id and b.agency_id = p_agency_id and b.active = true
  ) then
    raise exception 'return_branch_not_allowed' using errcode = '42501';
  end if;
  if not private.user_can_access_branch(p_agency_id, p_branch_id) then
    raise exception 'return_branch_not_allowed' using errcode = '42501';
  end if;
  manager_can_change_return_branch := public.user_has_permission(p_agency_id, 'branches.update');
  if contract_row.return_branch_id is not null
     and contract_row.return_branch_id <> p_branch_id
     and not manager_can_change_return_branch then
    raise exception 'return_branch_change_requires_manager' using errcode = '42501';
  end if;

  select * into checkin_row
    from public.contract_checkins
   where contract_id = p_contract_id
     and agency_id = p_agency_id
   for update;
  if not found then
    raise exception 'checkin_review_required' using errcode = '23514';
  end if;
  if checkin_row.status = 'FINALIZED' then
    return jsonb_build_object(
      'id', checkin_row.id,
      'status', 'FINALIZED',
      'replayed', true,
      'return_mileage', checkin_row.return_mileage,
      'fuel_level', checkin_row.fuel_level
    );
  end if;
  if checkin_row.status <> 'REVIEW' then
    raise exception 'checkin_review_required' using errcode = '23514';
  end if;

  select coalesce(co.mileage, contract_row.start_mileage)
    into checkout_mileage
    from public.contract_checkouts co
   where co.contract_id = p_contract_id
     and co.agency_id = p_agency_id
   limit 1;
  if checkout_mileage is null then
    raise exception 'checkout_required' using errcode = '23514';
  end if;
  if p_return_mileage < checkout_mileage then
    raise exception 'return_mileage_below_checkout' using errcode = '23514';
  end if;

  -- Finalization is only allowed once all required private photo metadata is
  -- present. Storage upload/retry remains a separate, resumable operation.
  select count(distinct photo_type)::integer into required_photo_count
    from public.contract_inspection_photos
   where agency_id = p_agency_id
     and contract_id = p_contract_id
     and inspection_type = 'RETURN'
     and photo_type in ('FRONT', 'REAR', 'LEFT', 'RIGHT', 'INTERIOR', 'DASHBOARD');
  if required_photo_count < 6 then
    raise exception 'return_photos_required' using errcode = '23514';
  end if;

  late_hours := greatest(0, ceil(extract(epoch from (
    p_actual_return_at - (contract_row.end_date::timestamp at time zone 'UTC')
  )) / 3600.0)::integer);
  late_days := case when late_hours > 0 then ceil(late_hours / 24.0)::integer else 0 end;
  driven_mileage := p_return_mileage - checkout_mileage;
  extra_mileage := case
    when contract_row.mileage_policy = 'LIMITED'
     and contract_row.mileage_allowance is not null
    then greatest(0, driven_mileage - greatest(0, contract_row.mileage_allowance))
    else 0
  end;
  fuel_delta := greatest(0, coalesce(contract_row.fuel_level_start, p_fuel_level) - p_fuel_level);

  -- Keep the return inspection and contract snapshot in the same transaction.
  select * into inspection_row
    from public.contract_inspections
   where contract_id = p_contract_id
     and inspection_type = 'RETURN'
   for update;
  if not found then
    insert into public.contract_inspections (
      agency_id, branch_id, contract_id, inspection_type, inspected_at,
      mileage, fuel_level, signature_name, notes, damage_notes, created_by,
      status, finalized_at, finalized_by
    ) values (
      p_agency_id, p_branch_id, p_contract_id, 'RETURN', p_actual_return_at,
      p_return_mileage, p_fuel_level, p_signature_name,
      nullif(concat_ws(E'\n', p_notes, p_exterior_condition, p_interior_condition), ''),
      nullif(p_missing_items::text, '[]'), actor, 'DRAFT', null, null
    ) returning * into inspection_row;
  elsif inspection_row.status = 'FINALIZED' then
    -- A previous attempt may have completed the inspection but not the check-in
    -- status. The check-in lock still makes this continuation deterministic.
    null;
  else
    update public.contract_inspections
       set branch_id = p_branch_id,
           inspected_at = p_actual_return_at,
           mileage = p_return_mileage,
           fuel_level = p_fuel_level,
           signature_name = p_signature_name,
           notes = nullif(concat_ws(E'\n', p_notes, p_exterior_condition, p_interior_condition), ''),
           damage_notes = nullif(p_missing_items::text, '[]')
     where id = inspection_row.id
     returning * into inspection_row;
  end if;

  update public.contracts
     set end_mileage = p_return_mileage,
         fuel_level_end = p_fuel_level,
         return_branch_id = p_branch_id,
         updated_at = now()
   where id = p_contract_id and agency_id = p_agency_id and status = 'ACTIVE';
  if not found then
    raise exception 'contract_changed_during_checkin' using errcode = '40001';
  end if;

  -- Replacing only automatic rows is retry-safe and preserves reviewed/manual
  -- damage or equipment charges entered by staff.
  delete from public.return_charges
   where contract_id = p_contract_id and source = 'AUTOMATIC';

  if late_days > 0 and contract_row.daily_rate > 0 then
    insert into public.return_charges (
      agency_id, branch_id, contract_id, checkin_id, charge_type,
      quantity, unit_price, amount, reason, source, created_by
    ) values (
      p_agency_id, p_branch_id, p_contract_id, checkin_row.id, 'LATE_RETURN',
      late_days, round(contract_row.daily_rate, 2),
      round(late_days * contract_row.daily_rate, 2),
      format('%s jour(s) de retard', late_days), 'AUTOMATIC', actor
    );
  end if;
  if extra_mileage > 0 and coalesce(contract_row.extra_mileage_rate, 0) > 0 then
    insert into public.return_charges (
      agency_id, branch_id, contract_id, checkin_id, charge_type,
      quantity, unit_price, amount, reason, source, created_by
    ) values (
      p_agency_id, p_branch_id, p_contract_id, checkin_row.id, 'EXTRA_MILEAGE',
      extra_mileage, round(contract_row.extra_mileage_rate, 2),
      round(extra_mileage * contract_row.extra_mileage_rate, 2),
      format('%s km supplémentaires', extra_mileage), 'AUTOMATIC', actor
    );
  end if;
  if fuel_delta > 0 and coalesce(contract_row.fuel_shortfall_rate, 0) > 0 then
    insert into public.return_charges (
      agency_id, branch_id, contract_id, checkin_id, charge_type,
      quantity, unit_price, amount, reason, source, created_by
    ) values (
      p_agency_id, p_branch_id, p_contract_id, checkin_row.id, 'FUEL',
      fuel_delta, round(contract_row.fuel_shortfall_rate, 2),
      round(fuel_delta * contract_row.fuel_shortfall_rate, 2),
      format('%s niveau(x) de carburant manquant(s)', fuel_delta), 'AUTOMATIC', actor
    );
  end if;
  if p_cleanliness = 'DIRTY' and coalesce(contract_row.cleaning_fee, 0) > 0 then
    insert into public.return_charges (
      agency_id, branch_id, contract_id, checkin_id, charge_type,
      quantity, unit_price, amount, reason, source, created_by
    ) values (
      p_agency_id, p_branch_id, p_contract_id, checkin_row.id, 'CLEANING',
      1, round(contract_row.cleaning_fee, 2), round(contract_row.cleaning_fee, 2),
      'Nettoyage nécessaire au retour', 'AUTOMATIC', actor
    );
  end if;

  select coalesce(sum(amount), 0) into automatic_total
    from public.return_charges
   where contract_id = p_contract_id and source = 'AUTOMATIC';

  if inspection_row.status <> 'FINALIZED' then
    update public.contract_inspections
       set status = 'FINALIZED', finalized_at = v_finalized_at, finalized_by = actor
     where id = inspection_row.id and status = 'DRAFT';
    if not found then
      raise exception 'return_inspection_finalize_conflict' using errcode = '40001';
    end if;
  end if;

  update public.contract_checkins
     set status = 'FINALIZED', finalized_at = v_finalized_at, finalized_by = actor,
         updated_at = now(), signature_data = coalesce(p_signature_data, signature_data)
   where id = checkin_row.id and agency_id = p_agency_id and status = 'REVIEW';
  if not found then
    raise exception 'checkin_finalize_conflict' using errcode = '40001';
  end if;

  return jsonb_build_object(
    'id', checkin_row.id,
    'inspection_id', inspection_row.id,
    'status', 'FINALIZED',
    'replayed', false,
    'late_hours', late_hours,
    'late_days', late_days,
    'driven_mileage', driven_mileage,
    'extra_mileage', extra_mileage,
    'fuel_delta', fuel_delta,
    'automatic_charges', round(automatic_total, 2)
  );
end;
$$;

revoke all on function public.finalize_contract_checkin(uuid, uuid, uuid, timestamptz, integer, integer, text, text, text, jsonb, text, text, text) from public, anon;
grant execute on function public.finalize_contract_checkin(uuid, uuid, uuid, timestamptz, integer, integer, text, text, text, jsonb, text, text, text) to authenticated;
