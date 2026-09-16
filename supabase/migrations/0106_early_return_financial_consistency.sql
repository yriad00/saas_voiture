-- Early-return decisions must change the rental total and the ledger together.
-- The previous function created a PARTIAL_REFUND payment while leaving the
-- contract total unchanged, which reopened the balance at closure.  Keep the
-- function idempotent and tenant-safe while making the adjustment explicit.
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
  elsif p_decision = 'PARTIAL_REFUND' then
    if refund_amount <= 0 then
      raise exception 'early_return_refund_required' using errcode = '22003';
    end if;
    -- The refund is also the authorized reduction of the rental amount.  This
    -- keeps amount_due unchanged after the payment ledger is reduced.
    adjustment := -refund_amount;
  end if;

  -- Resolve the deterministic refund row before enforcing the available
  -- balance. On a retry the original refund is already part of refund_total;
  -- counting it as available again makes a valid idempotent retry fail when
  -- the refund is larger than the remaining unpaid balance.
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
      available_to_refund := round(available_to_refund + existing_refund.amount, 2);
    end if;
  end if;
  if refund_amount > available_to_refund then
    raise exception 'early_return_refund_exceeds_paid' using errcode = '22003';
  end if;

  if c.early_return_decision is not null then
    if c.early_return_decision <> p_decision or round(coalesce(c.early_return_adjustment, 0), 2) <> adjustment then
      raise exception 'early_return_decision_conflict' using errcode = '23514';
    end if;
  end if;

  if refund_amount > 0 and not replayed then
      refund_id := public.record_payment_with_cash(
        p_agency_id, c.branch_id, p_contract_id, c.customer_id,
        refund_amount, p_refund_method, 'REFUND', 'COMPLETED',
        'EARLY_RETURN', now(), coalesce(nullif(p_note, ''), 'Remboursement retour anticipé'), v_idempotency_key
      );
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
