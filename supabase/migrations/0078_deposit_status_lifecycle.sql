-- Keep the caution status aligned with the actual remaining held balance.
alter table public.deposits
  drop constraint if exists deposits_status_check;
alter table public.deposits
  add constraint deposits_status_check
  check (status in ('REQUIRED','RECEIVED','HELD','PARTIALLY_DEDUCTED','PARTIALLY_REFUNDED','REFUNDED','CLOSED'));

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
begin
  perform pg_advisory_xact_lock(hashtextextended(new.deposit_id::text, 0));
  select * into d from public.deposits where id = new.deposit_id for update;
  if d.id is null or d.agency_id <> new.agency_id then
    raise exception 'deposit_scope_mismatch' using errcode = '23514';
  end if;
  available := d.held_amount - d.refunded_amount - d.deducted_amount;
  if new.transaction_type = 'RECEIVED' then
    remaining := d.required_amount - d.received_amount;
    if new.amount > remaining then
      raise exception 'deposit_required_amount_exceeded' using errcode = '23514';
    end if;
    update public.deposits set received_amount = received_amount + new.amount,
      held_amount = held_amount + new.amount, status = 'HELD', updated_at = now()
      where id = d.id;
  elsif new.transaction_type = 'DEDUCTION' then
    if new.amount > available then raise exception 'deposit_balance_exceeded' using errcode = '23514'; end if;
    next_deducted := d.deducted_amount + new.amount;
    update public.deposits set deducted_amount = next_deducted,
      status = case
        when next_deducted >= d.held_amount then 'CLOSED'
        else 'PARTIALLY_DEDUCTED'
      end,
      updated_at = now() where id = d.id;
  else
    if new.amount > available then raise exception 'deposit_balance_exceeded' using errcode = '23514'; end if;
    next_refunded := d.refunded_amount + new.amount;
    update public.deposits set refunded_amount = next_refunded,
      status = case
        when next_refunded + d.deducted_amount >= d.held_amount then 'REFUNDED'
        when next_refunded > 0 then 'PARTIALLY_REFUNDED'
        else 'HELD'
      end,
      updated_at = now() where id = d.id;
  end if;
  return new;
end;
$$;
