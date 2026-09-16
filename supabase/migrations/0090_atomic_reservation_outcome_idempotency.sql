-- Cancellation/no-show must commit the reservation outcome and any refund
-- together. This prevents a successful refund followed by a failed status
-- update (or the inverse) from leaving an inconsistent booking ledger.

create or replace function private.recompute_vehicle_status(
  p_agency_id uuid,
  p_vehicle_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_status public.vehicle_status;
  next_status public.vehicle_status := 'AVAILABLE';
begin
  select status into current_status
    from public.vehicles
   where id = p_vehicle_id and agency_id = p_agency_id and deleted_at is null
   for update;
  if not found then return; end if;

  if exists (select 1 from public.contracts where agency_id = p_agency_id and vehicle_id = p_vehicle_id and status = 'ACTIVE')
     or exists (select 1 from public.reservations where agency_id = p_agency_id and vehicle_id = p_vehicle_id and status = 'ONGOING') then
    next_status := 'RENTED';
  elsif exists (select 1 from public.reservations where agency_id = p_agency_id and vehicle_id = p_vehicle_id and status = 'CONFIRMED') then
    next_status := 'RESERVED';
  elsif exists (select 1 from public.vehicle_transfers where agency_id = p_agency_id and vehicle_id = p_vehicle_id and status = 'IN_TRANSIT')
     or exists (select 1 from public.vehicle_blocks where agency_id = p_agency_id and vehicle_id = p_vehicle_id and status = 'ACTIVE' and start_date <= current_date and end_date >= current_date)
     or exists (select 1 from public.damage_records where agency_id = p_agency_id and vehicle_id = p_vehicle_id and severity in ('MAJOR', 'CRITICAL') and status not in ('REPAIRED', 'CLOSED')) then
    next_status := 'OUT_OF_SERVICE';
  elsif current_status = 'OUT_OF_SERVICE' then
    next_status := 'OUT_OF_SERVICE';
  elsif exists (select 1 from public.maintenance_records where agency_id = p_agency_id and vehicle_id = p_vehicle_id and status in ('SCHEDULED', 'IN_PROGRESS')) then
    next_status := 'MAINTENANCE';
  end if;

  update public.vehicles
     set status = next_status, updated_at = now()
   where id = p_vehicle_id and agency_id = p_agency_id and deleted_at is null;
end;
$$;

create or replace function public.set_reservation_status_financial(
  p_agency_id uuid,
  p_reservation_id uuid,
  p_status public.reservation_status,
  p_reason text default null,
  p_refund_amount numeric default 0,
  p_refund_method public.payment_method default 'TRANSFER'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor uuid := auth.uid();
  reservation_row public.reservations%rowtype;
  payment_row record;
  available numeric := 0;
  refund_amount numeric := round(greatest(0, coalesce(p_refund_amount, 0)), 2);
  refund_id uuid := null;
  effective_branch uuid;
begin
  if actor is null or not public.is_agency_member(p_agency_id) then
    raise exception 'reservation_permission_denied' using errcode = '42501';
  end if;
  if p_status = 'CANCELLED' then
    if not public.user_has_permission(p_agency_id, 'reservations.cancel') then
      raise exception 'reservation_cancel_permission_denied' using errcode = '42501';
    end if;
  elsif not public.user_has_permission(p_agency_id, 'reservations.update') then
    raise exception 'reservation_update_permission_denied' using errcode = '42501';
  end if;
  if p_status not in ('CANCELLED', 'NO_SHOW') then
    raise exception 'reservation_outcome_invalid' using errcode = '22023';
  end if;
  if refund_amount > 0 and p_refund_method not in ('CASH', 'CARD', 'TRANSFER', 'CHECK') then
    raise exception 'reservation_refund_method_invalid' using errcode = '22023';
  end if;

  select * into reservation_row
    from public.reservations
   where id = p_reservation_id and agency_id = p_agency_id
   for update;
  if not found then raise exception 'reservation_not_found' using errcode = '23503'; end if;
  effective_branch := coalesce(reservation_row.pickup_branch_id, reservation_row.branch_id);
  if effective_branch is not null and not private.user_can_access_branch(p_agency_id, effective_branch) then
    raise exception 'reservation_branch_access_denied' using errcode = '42501';
  end if;
  if reservation_row.status = p_status then
    if round(coalesce(reservation_row.cancellation_refund_amount, 0), 2) <> refund_amount then
      raise exception 'idempotency_key_conflict' using errcode = '23514';
    end if;
    return jsonb_build_object('id', reservation_row.id, 'status', reservation_row.status, 'refund_amount', reservation_row.cancellation_refund_amount, 'replayed', true);
  end if;
  if reservation_row.status = 'PENDING' and p_status not in ('CANCELLED', 'NO_SHOW') then
    raise exception 'reservation_transition_invalid' using errcode = '23514';
  elsif reservation_row.status = 'CONFIRMED' and p_status not in ('CANCELLED', 'NO_SHOW') then
    raise exception 'reservation_transition_invalid' using errcode = '23514';
  end if;

  if refund_amount > 0 then
    if not public.user_has_permission(p_agency_id, 'payments.refund') then
      raise exception 'reservation_refund_permission_denied' using errcode = '42501';
    end if;
    -- Lock the source ledger rows while calculating the available refundable
    -- amount. The reservation lock serializes status/refund retries.
    for payment_row in
      select amount, type
        from public.payments
       where agency_id = p_agency_id and reservation_id = p_reservation_id and status = 'COMPLETED'
       for update
    loop
      if payment_row.type in ('RENTAL', 'PENALTY', 'EXTRA') then
        available := available + payment_row.amount;
      elsif payment_row.type = 'REFUND' then
        available := available - payment_row.amount;
      end if;
    end loop;
    if refund_amount > round(greatest(0, available), 2) then
      raise exception 'reservation_refund_exceeds_received' using errcode = '22003';
    end if;
    select public.record_reservation_payment_with_cash(
      p_agency_id,
      effective_branch,
      p_reservation_id,
      reservation_row.customer_id,
      refund_amount,
      p_refund_method,
      'REFUND'::public.payment_type,
      'COMPLETED'::public.payment_status,
      case when p_status = 'NO_SHOW' then 'RESERVATION_NO_SHOW' else 'RESERVATION_CANCELLED' end,
      now(),
      coalesce(nullif(p_reason, ''), case when p_status = 'NO_SHOW' then 'Remboursement no-show' else 'Remboursement annulation' end),
      lower(p_status::text) || '-refund:' || p_reservation_id::text
    ) into refund_id;
  end if;

  update public.reservations
     set status = p_status,
         cancellation_reason = nullif(trim(p_reason), ''),
         cancelled_at = now(),
         cancellation_refund_amount = refund_amount,
         updated_at = now()
   where id = p_reservation_id and agency_id = p_agency_id;
  if not found then raise exception 'reservation_outcome_conflict' using errcode = '40001'; end if;

  if reservation_row.vehicle_id is not null then
    perform private.recompute_vehicle_status(p_agency_id, reservation_row.vehicle_id);
  end if;

  return jsonb_build_object('id', reservation_row.id, 'status', p_status, 'refund_amount', refund_amount, 'refund_id', refund_id, 'replayed', false);
end;
$$;

revoke all on function public.set_reservation_status_financial(uuid, uuid, public.reservation_status, text, numeric, public.payment_method) from public, anon;
grant execute on function public.set_reservation_status_financial(uuid, uuid, public.reservation_status, text, numeric, public.payment_method) to authenticated;
