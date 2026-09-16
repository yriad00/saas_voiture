-- Keep cheque deposits traceable without turning them into revenue. The
-- existing deposit amount/status lifecycle remains unchanged; these fields
-- only describe the payment instrument and its operational state.
alter table public.deposits
  add column if not exists payment_method public.payment_method not null default 'CASH',
  add column if not exists cheque_status text;

alter table public.deposit_transactions
  add column if not exists payment_method public.payment_method not null default 'CASH',
  add column if not exists cheque_status text;

alter table public.deposits
  drop constraint if exists deposits_cheque_status_check,
  drop constraint if exists deposits_cheque_method_check;
alter table public.deposits
  add constraint deposits_cheque_status_check
    check (cheque_status is null or cheque_status in ('RECEIVED','HELD','RETURNED','DEPOSITED_USED','CANCELLED_PROBLEM')),
  add constraint deposits_cheque_method_check
    check ((payment_method = 'CHECK' and cheque_status is not null) or (payment_method <> 'CHECK' and cheque_status is null));

alter table public.deposit_transactions
  drop constraint if exists deposit_transactions_cheque_status_check,
  drop constraint if exists deposit_transactions_cheque_method_check;
alter table public.deposit_transactions
  add constraint deposit_transactions_cheque_status_check
    check (cheque_status is null or cheque_status in ('RECEIVED','HELD','RETURNED','DEPOSITED_USED','CANCELLED_PROBLEM')),
  add constraint deposit_transactions_cheque_method_check
    check ((payment_method = 'CHECK' and cheque_status is not null) or (payment_method <> 'CHECK' and cheque_status is null));

create index if not exists deposits_agency_cheque_status_idx
  on public.deposits (agency_id, payment_method, cheque_status)
  where payment_method = 'CHECK';

create index if not exists deposit_transactions_deposit_cheque_idx
  on public.deposit_transactions (deposit_id, payment_method, cheque_status);

-- Preserve the existing atomic amount/status trigger while carrying the
-- instrument state forward in the same transaction. Defaults are deliberately
-- derived by operation type so old callers remain compatible after the column
-- addition.
create or replace function private.apply_deposit_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  d public.deposits%rowtype;
  available numeric;
  remaining numeric;
  next_deducted numeric;
  next_refunded numeric;
  next_cheque_status text;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.deposit_id::text, 0));
  select * into d from public.deposits where id = new.deposit_id for update;
  if d.id is null or d.agency_id <> new.agency_id then
    raise exception 'deposit_scope_mismatch' using errcode = '23514';
  end if;

  if new.payment_method = 'CHECK' then
    next_cheque_status := coalesce(
      new.cheque_status,
      case new.transaction_type
        when 'RECEIVED' then 'RECEIVED'
        when 'DEDUCTION' then 'DEPOSITED_USED'
        when 'REFUND' then 'RETURNED'
      end
    );
  else
    next_cheque_status := null;
  end if;

  available := d.held_amount - d.refunded_amount - d.deducted_amount;
  if new.transaction_type = 'RECEIVED' then
    remaining := d.required_amount - d.received_amount;
    if new.amount > remaining then
      raise exception 'deposit_required_amount_exceeded' using errcode = '23514';
    end if;
    update public.deposits
       set received_amount = received_amount + new.amount,
           held_amount = held_amount + new.amount,
           payment_method = new.payment_method,
           cheque_status = next_cheque_status,
           status = 'HELD',
           updated_at = now()
     where id = d.id;
  elsif new.transaction_type = 'DEDUCTION' then
    if new.amount > available then
      raise exception 'deposit_balance_exceeded' using errcode = '23514';
    end if;
    next_deducted := d.deducted_amount + new.amount;
    update public.deposits
       set deducted_amount = next_deducted,
           payment_method = case when new.payment_method = 'CHECK' then 'CHECK' else payment_method end,
           cheque_status = case when new.payment_method = 'CHECK' then next_cheque_status else cheque_status end,
           status = case when next_deducted >= d.held_amount then 'CLOSED' else 'PARTIALLY_DEDUCTED' end,
           updated_at = now()
     where id = d.id;
  else
    if new.amount > available then
      raise exception 'deposit_balance_exceeded' using errcode = '23514';
    end if;
    next_refunded := d.refunded_amount + new.amount;
    update public.deposits
       set refunded_amount = next_refunded,
           payment_method = case when new.payment_method = 'CHECK' then 'CHECK' else payment_method end,
           cheque_status = case when new.payment_method = 'CHECK' then next_cheque_status else cheque_status end,
           status = case
             when next_refunded + d.deducted_amount >= d.held_amount then 'REFUNDED'
             when next_refunded > 0 then 'PARTIALLY_REFUNDED'
             else 'HELD'
           end,
           updated_at = now()
     where id = d.id;
  end if;
  return new;
end;
$$;

revoke all on function private.apply_deposit_transaction() from public, anon;
grant execute on function private.apply_deposit_transaction() to authenticated, service_role;
