-- Reusing an idempotency key with a different financial payload is a client
-- error. Returning the original row is safe only when the payload matches.
create or replace function public.record_payment_with_cash(
  p_agency_id uuid,
  p_branch_id uuid,
  p_contract_id uuid,
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
  payment_id uuid;
  prior_amount numeric;
  prior_contract uuid;
  prior_method public.payment_method;
  prior_type public.payment_type;
  prior_status public.payment_status;
  effective_branch uuid := p_branch_id;
  contract_customer uuid;
  contract_branch uuid;
  cash_session uuid;
begin
  if actor is null or not is_agency_member(p_agency_id) or not user_has_permission(p_agency_id, 'payments:write') then
    raise exception 'financial_permission_denied' using errcode = '42501';
  end if;
  if p_amount <= 0 then raise exception 'payment_amount_invalid' using errcode = '22003'; end if;

  if p_idempotency_key is not null then
    select id, amount, contract_id, method, type, status into payment_id, prior_amount, prior_contract, prior_method, prior_type, prior_status
      from public.payments where agency_id = p_agency_id and idempotency_key = p_idempotency_key limit 1;
    if payment_id is not null then
      if round(prior_amount, 2) <> round(p_amount, 2) or prior_contract is distinct from p_contract_id or prior_method <> p_method or prior_type <> p_type or prior_status <> p_status then
        raise exception 'idempotency_key_conflict' using errcode = '23514';
      end if;
      return payment_id;
    end if;
  end if;

  if p_contract_id is not null then
    select customer_id, branch_id into contract_customer, contract_branch from public.contracts where id = p_contract_id and agency_id = p_agency_id;
    if contract_customer is null then raise exception 'payment_contract_scope_mismatch' using errcode = '23514'; end if;
    if p_customer_id is not null and p_customer_id <> contract_customer then raise exception 'payment_customer_scope_mismatch' using errcode = '23514'; end if;
    effective_branch := coalesce(contract_branch, effective_branch);
  end if;
  if effective_branch is not null and not private.user_can_access_branch(p_agency_id, effective_branch) then raise exception 'payment_branch_scope_mismatch' using errcode = '42501'; end if;

  insert into public.payments (agency_id, branch_id, contract_id, customer_id, amount, method, type, status, reference, paid_at, notes, idempotency_key, created_by)
  values (p_agency_id, effective_branch, p_contract_id, coalesce(p_customer_id, contract_customer), round(p_amount, 2), p_method, p_type, p_status, nullif(p_reference, ''), coalesce(p_paid_at, now()), nullif(p_notes, ''), nullif(p_idempotency_key, ''), actor)
  on conflict do nothing returning id into payment_id;
  if payment_id is null then
    select id, amount, contract_id, method, type, status into payment_id, prior_amount, prior_contract, prior_method, prior_type, prior_status from public.payments where agency_id = p_agency_id and idempotency_key = p_idempotency_key limit 1;
    if payment_id is null then raise exception 'payment_insert_failed'; end if;
    if round(prior_amount, 2) <> round(p_amount, 2) or prior_contract is distinct from p_contract_id or prior_method <> p_method or prior_type <> p_type or prior_status <> p_status then raise exception 'idempotency_key_conflict' using errcode = '23514'; end if;
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

create or replace function public.record_expense_with_cash(
  p_agency_id uuid,
  p_branch_id uuid,
  p_vehicle_id uuid,
  p_category text,
  p_amount numeric,
  p_expense_date date,
  p_payment_method public.payment_method,
  p_vendor text default null,
  p_description text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor uuid := auth.uid();
  expense_id uuid;
  prior_amount numeric;
  prior_branch uuid;
  prior_vehicle uuid;
  prior_method public.payment_method;
  effective_branch uuid := p_branch_id;
  vehicle_branch uuid;
  cash_session uuid;
begin
  if actor is null or not is_agency_member(p_agency_id) or not user_has_permission(p_agency_id, 'expenses.create') then raise exception 'expense_permission_denied' using errcode = '42501'; end if;
  if p_amount <= 0 then raise exception 'expense_amount_invalid' using errcode = '22003'; end if;
  if p_idempotency_key is not null then
    select id, amount, branch_id, vehicle_id, payment_method into expense_id, prior_amount, prior_branch, prior_vehicle, prior_method from public.expenses where agency_id = p_agency_id and idempotency_key = p_idempotency_key limit 1;
    if expense_id is not null then
      if round(prior_amount, 2) <> round(p_amount, 2) or prior_branch is distinct from p_branch_id or prior_vehicle is distinct from p_vehicle_id or prior_method <> p_payment_method then raise exception 'idempotency_key_conflict' using errcode = '23514'; end if;
      return expense_id;
    end if;
  end if;
  if p_vehicle_id is not null then
    select branch_id into vehicle_branch from public.vehicles where id = p_vehicle_id and agency_id = p_agency_id and deleted_at is null;
    if vehicle_branch is null then raise exception 'expense_vehicle_scope_mismatch' using errcode = '23514'; end if;
    effective_branch := vehicle_branch;
  end if;
  if effective_branch is not null and not private.user_can_access_branch(p_agency_id, effective_branch) then raise exception 'expense_branch_scope_mismatch' using errcode = '42501'; end if;
  insert into public.expenses (agency_id, branch_id, vehicle_id, category, description, vendor, amount, expense_date, payment_method, idempotency_key, created_by)
  values (p_agency_id, effective_branch, p_vehicle_id, p_category, nullif(p_description, ''), nullif(p_vendor, ''), round(p_amount, 2), coalesce(p_expense_date, current_date), p_payment_method, nullif(p_idempotency_key, ''), actor)
  on conflict do nothing returning id into expense_id;
  if expense_id is null then
    select id, amount, branch_id, vehicle_id, payment_method into expense_id, prior_amount, prior_branch, prior_vehicle, prior_method from public.expenses where agency_id = p_agency_id and idempotency_key = p_idempotency_key limit 1;
    if expense_id is null then raise exception 'expense_insert_failed'; end if;
    if round(prior_amount, 2) <> round(p_amount, 2) or prior_branch is distinct from p_branch_id or prior_vehicle is distinct from p_vehicle_id or prior_method <> p_payment_method then raise exception 'idempotency_key_conflict' using errcode = '23514'; end if;
    return expense_id;
  end if;
  if p_payment_method = 'CASH' then
    if effective_branch is null then raise exception 'cash_expense_branch_required' using errcode = '23514'; end if;
    select id into cash_session from public.cash_sessions where agency_id = p_agency_id and branch_id = effective_branch and status = 'OPEN' for update;
    if cash_session is null then raise exception 'cash_session_required' using errcode = '23514'; end if;
    insert into public.cash_movements (agency_id, branch_id, session_id, movement_type, amount, reference_type, reference_id, reason, created_by)
    values (p_agency_id, effective_branch, cash_session, 'EXPENSE', round(p_amount, 2), 'EXPENSE', expense_id, coalesce(nullif(p_description, ''), p_category), actor)
    on conflict (session_id, reference_type, reference_id, movement_type) where reference_id is not null do nothing;
  end if;
  return expense_id;
end;
$$;
