-- Preserve the existing date based rental model while allowing new rentals to
-- store exact pickup/return instants.  NULL timestamps deliberately retain the
-- historical date-only semantics; no time is invented for old records.

alter table public.reservations
  add column if not exists pickup_at timestamptz,
  add column if not exists return_at timestamptz;

alter table public.contracts
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz;

alter table public.rental_extensions
  add column if not exists previous_end_at timestamptz,
  add column if not exists new_end_at timestamptz;

alter table public.reservations
  drop constraint if exists reservations_valid_period_check;
alter table public.reservations
  add constraint reservations_valid_period_check
  check (pickup_at is null or return_at is null or return_at > pickup_at);

alter table public.contracts
  drop constraint if exists contracts_valid_period_check;
alter table public.contracts
  add constraint contracts_valid_period_check
  check (start_at is null or end_at is null or end_at > start_at);

-- A date-only record keeps the original exclusive-end behavior.  A new record
-- with timestamps uses the exact instant range, so same-day airport handoffs
-- are allowed when the previous rental has actually ended.
create or replace function private.rental_period(
  p_start_date date,
  p_end_date date,
  p_start_at timestamptz,
  p_end_at timestamptz
)
returns tstzrange
language sql
immutable
parallel safe
set search_path = public, private
as $$
  select tstzrange(
    coalesce(p_start_at, p_start_date::timestamp at time zone 'UTC'),
    coalesce(
      p_end_at,
      case when p_end_date = p_start_date
        then (p_end_date + 1)::timestamp at time zone 'UTC'
        else p_end_date::timestamp at time zone 'UTC'
      end
    ),
    '[)'
  )
$$;

-- Replace the date-only exclusion constraints with the compatible mixed
-- date/timestamp expression. Existing rows remain protected by the fallback.
alter table public.reservations
  drop constraint if exists reservations_vehicle_no_overlap;
alter table public.reservations
  add constraint reservations_vehicle_no_overlap
  exclude using gist (
    agency_id with =,
    vehicle_id with =,
    private.rental_period(start_date, end_date, pickup_at, return_at) with &&
  )
  where (vehicle_id is not null and status in ('PENDING', 'CONFIRMED', 'ONGOING'));

alter table public.contracts
  drop constraint if exists contracts_vehicle_no_overlap;
alter table public.contracts
  add constraint contracts_vehicle_no_overlap
  exclude using gist (
    agency_id with =,
    vehicle_id with =,
    private.rental_period(start_date, end_date, start_at, end_at) with &&
  )
  where (vehicle_id is not null and status = 'ACTIVE');

create index if not exists reservations_agency_vehicle_period_idx
  on public.reservations (agency_id, vehicle_id, pickup_at, return_at)
  where vehicle_id is not null and status in ('PENDING', 'CONFIRMED', 'ONGOING');
create index if not exists contracts_agency_vehicle_period_idx
  on public.contracts (agency_id, vehicle_id, start_at, end_at)
  where status = 'ACTIVE';

-- Keep trigger-level guards aligned with the exclusion constraints for blocks
-- and the reservation/contract cross-check.
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
  -- vehicle_blocks predates the timestamp columns; its date range remains a
  -- conservative whole-day block.
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

revoke all on function private.rental_period(date, date, timestamptz, timestamptz) from public, anon;
-- The exclusion constraint and trigger evaluate this immutable helper as the
-- inserting role (including service_role during controlled fixture setup).
-- It exposes no data and cannot mutate state, so execution is safe for these
-- database roles while the schema remains private.
grant execute on function private.rental_period(date, date, timestamptz, timestamptz) to authenticated, service_role;

-- Early-return policy, refund and contract decision share one transaction.
-- This closes the gap where a refund could be committed while the decision
-- update failed (or vice versa).
create or replace function public.decide_early_return_atomic(
  p_agency_id uuid,
  p_contract_id uuid,
  p_decision text,
  p_refund_amount numeric default 0,
  p_refund_method public.payment_method default 'TRANSFER',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor uuid := auth.uid();
  c public.contracts%rowtype;
  checkin_row public.contract_checkins%rowtype;
  payment_row record;
  existing_refund record;
  refund_id uuid;
  start_instant timestamptz;
  planned_end_instant timestamptz;
  actual_days integer;
  recalculated_base numeric := 0;
  adjustment numeric := 0;
  refund_amount numeric := round(greatest(coalesce(p_refund_amount, 0), 0), 2);
  available_to_refund numeric := 0;
  paid_total numeric := 0;
  refund_total numeric := 0;
  v_idempotency_key text;
  replayed boolean := false;
begin
  if actor is null
     or not public.is_agency_member(p_agency_id)
     or not public.user_has_permission(p_agency_id, 'contracts.update') then
    raise exception 'early_return_permission_denied' using errcode = '42501';
  end if;
  if p_decision not in ('NO_REFUND', 'RECALCULATE', 'PARTIAL_REFUND') then
    raise exception 'early_return_decision_invalid' using errcode = '22023';
  end if;
  if refund_amount < 0 then
    raise exception 'early_return_refund_invalid' using errcode = '22003';
  end if;
  if p_decision = 'NO_REFUND' and refund_amount <> 0 then
    raise exception 'early_return_refund_invalid' using errcode = '22003';
  end if;
  if refund_amount > 0 and p_refund_method not in ('CASH', 'CARD', 'TRANSFER', 'CHECK') then
    raise exception 'early_return_refund_method_invalid' using errcode = '22023';
  end if;
  if refund_amount > 0 and not public.user_has_permission(p_agency_id, 'payments.refund') then
    raise exception 'early_return_refund_permission_denied' using errcode = '42501';
  end if;

  select * into c from public.contracts
   where id = p_contract_id and agency_id = p_agency_id
   for update;
  if not found then raise exception 'contract_not_found' using errcode = '23503'; end if;
  if c.status <> 'ACTIVE' then raise exception 'contract_not_active' using errcode = '23514'; end if;

  select * into checkin_row from public.contract_checkins
   where contract_id = p_contract_id and agency_id = p_agency_id
   for update;
  if not found or checkin_row.status <> 'FINALIZED' then
    raise exception 'finalized_checkin_required' using errcode = '23514';
  end if;

  start_instant := coalesce(c.start_at, c.start_date::timestamp at time zone 'UTC');
  planned_end_instant := coalesce(c.end_at, c.end_date::timestamp at time zone 'UTC');
  if checkin_row.actual_return_at >= planned_end_instant then
    raise exception 'not_an_early_return' using errcode = '23514';
  end if;
  actual_days := greatest(1, ceil(extract(epoch from (checkin_row.actual_return_at - start_instant)) / 86400.0)::integer);

  -- Serialize the refundable balance calculation with concurrent payments.
  for payment_row in
    select amount, type, status
      from public.payments
     where agency_id = p_agency_id and contract_id = p_contract_id
     for update
  loop
    if payment_row.status = 'COMPLETED' and payment_row.type in ('RENTAL', 'PENALTY', 'EXTRA') then
      paid_total := paid_total + payment_row.amount;
    elsif payment_row.status = 'COMPLETED' and payment_row.type = 'REFUND' then
      refund_total := refund_total + payment_row.amount;
    end if;
  end loop;
  paid_total := round(greatest(0, paid_total), 2);
  refund_total := round(greatest(0, refund_total), 2);
  available_to_refund := round(greatest(0, paid_total - refund_total), 2);

  if p_decision = 'RECALCULATE' then
    recalculated_base := round(least(coalesce(c.base_total_amount, c.total_amount), actual_days * c.daily_rate), 2);
    adjustment := round(recalculated_base - coalesce(c.base_total_amount, c.total_amount, 0), 2);
    refund_amount := round(greatest(0, paid_total - round(
      coalesce(c.base_total_amount, c.total_amount, 0)
      + coalesce(c.extras_total, 0)
      + coalesce(c.one_way_fee, 0)
      + adjustment
      + coalesce(c.return_charges_total, 0), 2)), 2);
  elsif p_decision = 'PARTIAL_REFUND' and refund_amount <= 0 then
    raise exception 'early_return_refund_required' using errcode = '22003';
  end if;
  if refund_amount > available_to_refund then
    raise exception 'early_return_refund_exceeds_paid' using errcode = '22003';
  end if;

  if c.early_return_decision is not null then
    if c.early_return_decision <> p_decision or round(coalesce(c.early_return_adjustment, 0), 2) <> adjustment then
      raise exception 'early_return_decision_conflict' using errcode = '23514';
    end if;
  end if;

  if refund_amount > 0 then
    v_idempotency_key := 'early-return-refund:' || p_contract_id::text;
    select p.id, p.amount, p.method, p.type, p.status into existing_refund
      from public.payments p
     where p.agency_id = p_agency_id and p.idempotency_key = v_idempotency_key
     for update;
    if found then
      if round(existing_refund.amount, 2) <> refund_amount
         or existing_refund.method <> p_refund_method
         or existing_refund.type <> 'REFUND'
         or existing_refund.status <> 'COMPLETED' then
        raise exception 'early_return_refund_idempotency_conflict' using errcode = '23514';
      end if;
      refund_id := existing_refund.id;
      replayed := true;
    else
      refund_id := public.record_payment_with_cash(
        p_agency_id, c.branch_id, p_contract_id, c.customer_id,
        refund_amount, p_refund_method, 'REFUND', 'COMPLETED',
        'EARLY_RETURN', now(), coalesce(nullif(p_note, ''), 'Remboursement retour anticipé'), v_idempotency_key
      );
    end if;
  end if;

  update public.contracts
     set early_return_decision = p_decision,
         early_return_adjustment = adjustment,
         early_return_decided_by = actor,
         early_return_decided_at = coalesce(early_return_decided_at, now()),
         updated_at = now()
   where id = p_contract_id and agency_id = p_agency_id and status = 'ACTIVE';
  if not found then raise exception 'early_return_decision_conflict' using errcode = '40001'; end if;

  insert into public.audit_logs (agency_id, branch_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_agency_id, c.branch_id, actor, 'EARLY_RETURN_DECISION_RECORDED', 'contract', p_contract_id,
          jsonb_build_object('decision', p_decision, 'refund_amount', refund_amount,
                             'adjustment', adjustment, 'actual_days', actual_days,
                             'refund_id', refund_id, 'replayed', replayed,
                             'note', nullif(p_note, '')));

  return jsonb_build_object('id', p_contract_id, 'decision', p_decision,
                            'refund_amount', refund_amount, 'adjustment', adjustment,
                            'refund_id', refund_id, 'replayed', replayed);
end;
$$;

revoke all on function public.decide_early_return_atomic(uuid, uuid, text, numeric, public.payment_method, text) from public, anon;
grant execute on function public.decide_early_return_atomic(uuid, uuid, text, numeric, public.payment_method, text) to authenticated;

-- Reinstall the finalization function so exact contract return times are used.
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
    p_actual_return_at - coalesce(contract_row.end_at, contract_row.end_date::timestamp at time zone 'UTC')
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

