-- Serialize completed refunds per contract and reject concurrent over-refunds.
-- The function intentionally remains SECURITY INVOKER: callers can only see
-- payment and contract rows allowed by their agency RLS policies.
create or replace function public.validate_payment_refund()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  available_amount numeric(14, 2);
  source_amount numeric(14, 2);
  refunded_amount numeric(14, 2);
begin
  if new.status <> 'COMPLETED' or new.type not in ('REFUND', 'DEPOSIT_REFUND') then
    return new;
  end if;

  if new.contract_id is null then
    raise exception 'A completed refund must be linked to a contract';
  end if;

  perform 1
  from public.contracts
  where id = new.contract_id and agency_id = new.agency_id
  for update;
  if not found then
    raise exception 'Refund contract does not belong to the payment agency';
  end if;

  select coalesce(sum(amount), 0)
    into source_amount
  from public.payments
  where agency_id = new.agency_id
    and contract_id = new.contract_id
    and status = 'COMPLETED'
    and type = any(case when new.type = 'DEPOSIT_REFUND'
      then array['DEPOSIT']::public.payment_type[]
      else array['RENTAL', 'PENALTY', 'EXTRA']::public.payment_type[] end);

  select coalesce(sum(amount), 0)
    into refunded_amount
  from public.payments
  where agency_id = new.agency_id
    and contract_id = new.contract_id
    and status = 'COMPLETED'
    and type = new.type;

  available_amount := source_amount - refunded_amount;
  if new.amount > available_amount then
    raise exception 'Refund exceeds the amount available on the contract';
  end if;
  return new;
end;
$$;

drop trigger if exists payments_validate_refund on public.payments;
create trigger payments_validate_refund
before insert or update of amount, contract_id, agency_id, type, status
on public.payments
for each row execute function public.validate_payment_refund();
