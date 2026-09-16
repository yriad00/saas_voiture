-- Contract closure is the final operational/financial boundary. Keep the
-- settlement checks and state changes in one transaction, including one-way
-- branch placement and the vehicle/reservation status updates.

create or replace function public.close_contract_atomic(
  p_agency_id uuid,
  p_contract_id uuid,
  p_end_mileage integer default null,
  p_fuel_level_end integer default null
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
  inspection_status text;
  final_return_branch uuid;
  vehicle_branch uuid;
  reservation_status public.reservation_status;
  base_total numeric := 0;
  return_total numeric := 0;
  paid_total numeric := 0;
  refund_total numeric := 0;
  deposit_settlement numeric := 0;
  grand_total numeric := 0;
  amount_due numeric := 0;
  payment_row record;
  deposit_row record;
begin
  if actor is null or not public.is_agency_member(p_agency_id) or not public.user_has_permission(p_agency_id, 'contracts.update') then
    raise exception 'contract_close_permission_denied' using errcode = '42501';
  end if;

  select * into c
    from public.contracts
   where id = p_contract_id and agency_id = p_agency_id
   for update;
  if not found then raise exception 'contract_not_found' using errcode = '23503'; end if;
  if c.status = 'CLOSED' then
    return jsonb_build_object('id', c.id, 'status', 'CLOSED', 'replayed', true, 'final_total_amount', c.final_total_amount);
  end if;
  if c.status <> 'ACTIVE' then raise exception 'contract_not_active' using errcode = '23514'; end if;

  select * into checkin_row
    from public.contract_checkins
   where contract_id = p_contract_id and agency_id = p_agency_id
   for update;
  if not found or checkin_row.status <> 'FINALIZED' then
    raise exception 'finalized_checkin_required' using errcode = '23514';
  end if;
  select status into inspection_status
    from public.contract_inspections
   where contract_id = p_contract_id and agency_id = p_agency_id and inspection_type = 'RETURN';
  if inspection_status <> 'FINALIZED' then
    raise exception 'finalized_return_inspection_required' using errcode = '23514';
  end if;

  final_return_branch := coalesce(checkin_row.branch_id, c.return_branch_id, c.branch_id);
  if final_return_branch is null or not exists (
    select 1 from public.branches b where b.id = final_return_branch and b.agency_id = p_agency_id and b.active = true
  ) then
    raise exception 'return_branch_not_allowed' using errcode = '42501';
  end if;
  if final_return_branch <> c.branch_id then
    if not private.user_can_access_branch(p_agency_id, final_return_branch)
       or not public.user_has_permission(p_agency_id, 'branches.update') then
      raise exception 'one_way_close_requires_manager' using errcode = '42501';
    end if;
  elsif not private.user_can_access_branch(p_agency_id, c.branch_id) then
    raise exception 'contract_branch_access_denied' using errcode = '42501';
  end if;

  if p_end_mileage is not null and p_end_mileage < coalesce(checkin_row.return_mileage, c.start_mileage, p_end_mileage) then
    raise exception 'return_mileage_below_checkout' using errcode = '23514';
  end if;
  if p_fuel_level_end is not null and (p_fuel_level_end < 0 or p_fuel_level_end > 8) then
    raise exception 'return_fuel_invalid' using errcode = '22003';
  end if;

  base_total := round(coalesce(c.base_total_amount, c.total_amount, 0) + coalesce(c.extras_total, 0) + coalesce(c.one_way_fee, 0), 2);
  select coalesce(sum(amount), 0) into return_total
    from public.return_charges
   where agency_id = p_agency_id and contract_id = p_contract_id;
  grand_total := round(base_total + return_total + coalesce(c.early_return_adjustment, 0), 2);
  if c.final_total_amount is not null then grand_total := round(c.final_total_amount, 2); end if;

  for payment_row in
    select amount, type from public.payments
     where agency_id = p_agency_id and contract_id = p_contract_id and status = 'COMPLETED'
     for update
  loop
    if payment_row.type in ('RENTAL', 'PENALTY', 'EXTRA') then paid_total := paid_total + payment_row.amount;
    elsif payment_row.type = 'REFUND' then refund_total := refund_total + payment_row.amount;
    end if;
  end loop;
  paid_total := round(greatest(0, paid_total - refund_total), 2);
  select coalesce(sum(dt.amount), 0) into deposit_settlement
    from public.deposit_transactions dt
    join public.deposits d on d.id = dt.deposit_id
   where dt.agency_id = p_agency_id and d.contract_id = p_contract_id
     and dt.transaction_type = 'DEDUCTION' and dt.settles_balance = true;
  amount_due := round(greatest(0, grand_total - paid_total - deposit_settlement), 2);
  if amount_due > 0.01 then raise exception 'contract_balance_unsettled' using errcode = '23514'; end if;

  select required_amount, status into deposit_row
    from public.deposits where agency_id = p_agency_id and contract_id = p_contract_id for update;
  if found and coalesce(deposit_row.required_amount, 0) > 0 and deposit_row.status not in ('REFUNDED', 'CLOSED') then
    raise exception 'deposit_unsettled' using errcode = '23514';
  end if;

  update public.contracts
     set status = 'CLOSED',
         end_mileage = coalesce(p_end_mileage, checkin_row.return_mileage),
         fuel_level_end = coalesce(p_fuel_level_end, checkin_row.fuel_level),
         return_branch_id = final_return_branch,
         final_total_amount = grand_total,
         updated_at = now()
   where id = p_contract_id and agency_id = p_agency_id and status = 'ACTIVE';
  if not found then raise exception 'contract_close_conflict' using errcode = '40001'; end if;

  if c.reservation_id is not null then
    update public.reservations
       set status = 'COMPLETED', updated_at = now()
     where id = c.reservation_id and agency_id = p_agency_id;
  end if;

  update public.vehicles
     set branch_id = final_return_branch,
         mileage = coalesce(p_end_mileage, checkin_row.return_mileage, mileage),
         updated_at = now()
   where id = c.vehicle_id and agency_id = p_agency_id and deleted_at is null
   returning branch_id into vehicle_branch;
  if not found then raise exception 'vehicle_not_found' using errcode = '23503'; end if;
  perform private.recompute_vehicle_status(p_agency_id, c.vehicle_id);

  return jsonb_build_object('id', c.id, 'status', 'CLOSED', 'replayed', false, 'final_total_amount', grand_total, 'return_branch_id', final_return_branch, 'amount_due', amount_due);
end;
$$;

revoke all on function public.close_contract_atomic(uuid, uuid, integer, integer) from public, anon;
grant execute on function public.close_contract_atomic(uuid, uuid, integer, integer) to authenticated;

