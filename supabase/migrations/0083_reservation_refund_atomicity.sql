-- Reservation refunds must pass the same over-refund guard as contract
-- refunds. The reservation ledger is independent until a contract exists.
create or replace function public.validate_payment_refund()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  source_amount numeric(14, 2);
  refunded_amount numeric(14, 2);
begin
  if new.status <> 'COMPLETED' or new.type not in ('REFUND', 'DEPOSIT_REFUND') then
    return new;
  end if;

  if new.contract_id is null and new.reservation_id is null then
    raise exception 'A completed refund must be linked to a contract or reservation';
  end if;

  if new.contract_id is not null then
    perform 1 from public.contracts where id = new.contract_id and agency_id = new.agency_id for update;
    if not found then raise exception 'Refund contract does not belong to the payment agency'; end if;
    select coalesce(sum(amount), 0) into source_amount
      from public.payments
     where agency_id = new.agency_id and contract_id = new.contract_id and status = 'COMPLETED'
       and type = any(case when new.type = 'DEPOSIT_REFUND' then array['DEPOSIT']::public.payment_type[] else array['RENTAL', 'PENALTY', 'EXTRA']::public.payment_type[] end);
    select coalesce(sum(amount), 0) into refunded_amount
      from public.payments
     where agency_id = new.agency_id and contract_id = new.contract_id and status = 'COMPLETED' and type = new.type;
  else
    perform 1 from public.reservations where id = new.reservation_id and agency_id = new.agency_id for update;
    if not found then raise exception 'Refund reservation does not belong to the payment agency'; end if;
    select coalesce(sum(amount), 0) into source_amount
      from public.payments
     where agency_id = new.agency_id and reservation_id = new.reservation_id and status = 'COMPLETED'
       and type = any(case when new.type = 'DEPOSIT_REFUND' then array['DEPOSIT']::public.payment_type[] else array['RENTAL', 'PENALTY', 'EXTRA']::public.payment_type[] end);
    select coalesce(sum(amount), 0) into refunded_amount
      from public.payments
     where agency_id = new.agency_id and reservation_id = new.reservation_id and status = 'COMPLETED' and type = new.type;
  end if;

  if new.amount > source_amount - refunded_amount then
    raise exception 'Refund exceeds the amount available on the contract or reservation';
  end if;
  return new;
end;
$$;

drop function if exists public.record_reservation_payment_with_cash(uuid, uuid, uuid, uuid, numeric, public.payment_method, public.payment_type, public.payment_status, text, timestamptz, text, text);
create or replace function public.record_reservation_payment_with_cash(
  p_agency_id uuid,
  p_branch_id uuid,
  p_reservation_id uuid,
  p_customer_id uuid,
  p_amount numeric,
  p_method public.payment_method,
  p_type public.payment_type,
  p_status public.payment_status,
  p_reference text default null,
  p_paid_at timestamptz default now(),
  p_notes text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor uuid := auth.uid();
  reservation_customer uuid;
  reservation_branch uuid;
  payment_id uuid;
  prior_amount numeric;
  prior_reservation uuid;
  prior_method public.payment_method;
  prior_type public.payment_type;
  prior_status public.payment_status;
  effective_branch uuid;
  cash_session uuid;
begin
  if actor is null or not is_agency_member(p_agency_id) or not user_has_permission(p_agency_id, 'payments:write') then
    raise exception 'financial_permission_denied' using errcode = '42501';
  end if;
  if p_reservation_id is null or p_amount <= 0 then
    raise exception 'reservation_payment_invalid' using errcode = '22003';
  end if;

  select customer_id, coalesce(pickup_branch_id, branch_id)
    into reservation_customer, reservation_branch
    from public.reservations
   where id = p_reservation_id and agency_id = p_agency_id
   for update;
  if reservation_customer is null then raise exception 'payment_reservation_scope_mismatch' using errcode = '23514'; end if;
  if p_customer_id is not null and p_customer_id <> reservation_customer then raise exception 'payment_reservation_customer_mismatch' using errcode = '23514'; end if;
  if p_branch_id is not null and reservation_branch is not null and p_branch_id <> reservation_branch then raise exception 'payment_reservation_branch_mismatch' using errcode = '23514'; end if;
  effective_branch := coalesce(reservation_branch, p_branch_id);
  if effective_branch is not null and not private.user_can_access_branch(p_agency_id, effective_branch) then raise exception 'payment_branch_scope_mismatch' using errcode = '42501'; end if;

  if p_idempotency_key is not null then
    select id, amount, reservation_id, method, type, status into payment_id, prior_amount, prior_reservation, prior_method, prior_type, prior_status
      from public.payments where agency_id = p_agency_id and idempotency_key = p_idempotency_key limit 1;
    if payment_id is not null then
      if round(prior_amount, 2) <> round(p_amount, 2) or prior_reservation is distinct from p_reservation_id or prior_method <> p_method or prior_type <> p_type or prior_status <> p_status then
        raise exception 'idempotency_key_conflict' using errcode = '23514';
      end if;
      return payment_id;
    end if;
  end if;

  insert into public.payments (agency_id, branch_id, reservation_id, customer_id, amount, method, type, status, reference, paid_at, notes, idempotency_key, created_by)
  values (p_agency_id, effective_branch, p_reservation_id, reservation_customer, round(p_amount, 2), p_method, p_type, p_status, nullif(p_reference, ''), coalesce(p_paid_at, now()), nullif(p_notes, ''), nullif(p_idempotency_key, ''), actor)
  on conflict do nothing returning id into payment_id;
  if payment_id is null then
    select id, amount, reservation_id, method, type, status into payment_id, prior_amount, prior_reservation, prior_method, prior_type, prior_status
      from public.payments where agency_id = p_agency_id and idempotency_key = p_idempotency_key limit 1;
    if payment_id is null then raise exception 'reservation_payment_insert_failed'; end if;
    if round(prior_amount, 2) <> round(p_amount, 2) or prior_reservation is distinct from p_reservation_id or prior_method <> p_method or prior_type <> p_type or prior_status <> p_status then raise exception 'idempotency_key_conflict' using errcode = '23514'; end if;
    return payment_id;
  end if;

  if p_method = 'CASH' and p_status = 'COMPLETED' then
    if effective_branch is null then raise exception 'cash_payment_branch_required' using errcode = '23514'; end if;
    select id into cash_session from public.cash_sessions where agency_id = p_agency_id and branch_id = effective_branch and status = 'OPEN' for update;
    if cash_session is null then raise exception 'cash_session_required' using errcode = '23514'; end if;
    insert into public.cash_movements (agency_id, branch_id, session_id, movement_type, amount, reference_type, reference_id, reason, created_by)
    values (p_agency_id, effective_branch, cash_session, case when p_type in ('REFUND', 'DEPOSIT_REFUND') then 'REFUND' else 'PAYMENT' end, round(p_amount, 2), 'PAYMENT', payment_id, coalesce(p_type::text || ' · ' || nullif(p_reference, ''), p_type::text), actor)
    on conflict (session_id, reference_type, reference_id, movement_type) where reference_id is not null do nothing;
  end if;
  return payment_id;
end;
$$;

revoke all on function public.record_reservation_payment_with_cash(uuid, uuid, uuid, uuid, numeric, public.payment_method, public.payment_type, public.payment_status, text, timestamptz, text, text) from public, anon;
grant execute on function public.record_reservation_payment_with_cash(uuid, uuid, uuid, uuid, numeric, public.payment_method, public.payment_type, public.payment_status, text, timestamptz, text, text) to authenticated;
