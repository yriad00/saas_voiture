-- Link reservation advances/refunds to the existing payments ledger. This
-- closes the cancellation/no-show path without introducing a second ledger.
alter table public.payments
  add constraint payments_reservation_customer_scope_check
  check (reservation_id is null or customer_id is not null);

create or replace function private.validate_payment_reservation_scope()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  reservation_agency uuid;
  reservation_customer uuid;
  reservation_branch uuid;
begin
  if new.reservation_id is null then
    return new;
  end if;

  select agency_id, customer_id, coalesce(pickup_branch_id, branch_id)
    into reservation_agency, reservation_customer, reservation_branch
    from public.reservations
   where id = new.reservation_id;

  if reservation_agency is null or reservation_agency <> new.agency_id then
    raise exception 'payment_reservation_scope_mismatch' using errcode = '23514';
  end if;
  if new.customer_id is distinct from reservation_customer then
    raise exception 'payment_reservation_customer_mismatch' using errcode = '23514';
  end if;
  if new.branch_id is not null and reservation_branch is not null and new.branch_id <> reservation_branch then
    raise exception 'payment_reservation_branch_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_payment_reservation_scope() from public;
drop trigger if exists payments_reservation_scope on public.payments;
create trigger payments_reservation_scope
  before insert or update of reservation_id, agency_id, customer_id, branch_id
  on public.payments
  for each row execute function private.validate_payment_reservation_scope();

create index if not exists payments_agency_reservation_type_idx
  on public.payments (agency_id, reservation_id, type, status, paid_at desc)
  where reservation_id is not null;

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
  effective_branch uuid := p_branch_id;
begin
  if actor is null
     or not is_agency_member(p_agency_id)
     or not user_has_permission(p_agency_id, 'payments:write') then
    raise exception 'financial_permission_denied' using errcode = '42501';
  end if;
  if p_reservation_id is null or p_amount <= 0 then
    raise exception 'reservation_payment_invalid' using errcode = '22003';
  end if;

  select customer_id, coalesce(pickup_branch_id, branch_id)
    into reservation_customer, reservation_branch
    from public.reservations
   where id = p_reservation_id and agency_id = p_agency_id;
  if reservation_customer is null then
    raise exception 'payment_reservation_scope_mismatch' using errcode = '23514';
  end if;
  if p_customer_id is not null and p_customer_id <> reservation_customer then
    raise exception 'payment_reservation_customer_mismatch' using errcode = '23514';
  end if;
  if reservation_branch is not null and p_branch_id is not null and reservation_branch <> p_branch_id then
    raise exception 'payment_reservation_branch_mismatch' using errcode = '23514';
  end if;
  effective_branch := coalesce(reservation_branch, p_branch_id);
  if effective_branch is not null and not private.user_can_access_branch(p_agency_id, effective_branch) then
    raise exception 'payment_branch_scope_mismatch' using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    select id, amount, reservation_id, method, type, status
      into payment_id, prior_amount, prior_reservation, prior_method, prior_type, prior_status
      from public.payments
     where agency_id = p_agency_id and idempotency_key = p_idempotency_key
     limit 1;
    if payment_id is not null then
      if round(prior_amount, 2) <> round(p_amount, 2)
         or prior_reservation is distinct from p_reservation_id
         or prior_method <> p_method
         or prior_type <> p_type
         or prior_status <> p_status then
        raise exception 'idempotency_key_conflict' using errcode = '23514';
      end if;
      return payment_id;
    end if;
  end if;

  -- The existing RPC owns the atomic payment + cash movement write. The
  -- reservation link is attached before this wrapper returns, so a failure
  -- rolls back both the ledger row and any caisse movement.
  payment_id := public.record_payment_with_cash(
    p_agency_id,
    effective_branch,
    null,
    reservation_customer,
    p_amount,
    p_method,
    p_type,
    p_status,
    p_reference,
    p_paid_at,
    p_notes,
    p_idempotency_key
  );

  update public.payments
     set reservation_id = p_reservation_id
   where id = payment_id
     and agency_id = p_agency_id
     and (reservation_id is null or reservation_id = p_reservation_id);
  if not found then
    raise exception 'payment_reservation_link_failed' using errcode = '23514';
  end if;
  return payment_id;
end;
$$;

revoke all on function public.record_reservation_payment_with_cash(uuid, uuid, uuid, uuid, numeric, public.payment_method, public.payment_type, public.payment_status, text, timestamptz, text, text) from public, anon;
grant execute on function public.record_reservation_payment_with_cash(uuid, uuid, uuid, uuid, numeric, public.payment_method, public.payment_type, public.payment_status, text, timestamptz, text, text) to authenticated;
