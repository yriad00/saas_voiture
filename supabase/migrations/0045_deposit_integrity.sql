create or replace function private.apply_deposit_transaction() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare d public.deposits%rowtype; available numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.deposit_id::text, 0));
  select * into d from public.deposits where id = new.deposit_id for update;
  if d.id is null or d.agency_id <> new.agency_id then raise exception 'deposit_scope_mismatch' using errcode='23514'; end if;
  available := d.held_amount - d.refunded_amount - d.deducted_amount;
  if new.transaction_type in ('REFUND','DEDUCTION') and new.amount > available then raise exception 'deposit_balance_exceeded' using errcode='23514'; end if;
  if new.transaction_type = 'RECEIVED' then
    update public.deposits set received_amount = received_amount + new.amount, held_amount = held_amount + new.amount, status = 'HELD', updated_at = now() where id = d.id;
  elsif new.transaction_type = 'DEDUCTION' then
    update public.deposits set deducted_amount = deducted_amount + new.amount, status = case when deducted_amount + new.amount >= held_amount then 'PARTIALLY_DEDUCTED' else 'PARTIALLY_DEDUCTED' end, updated_at = now() where id = d.id;
  else
    update public.deposits set refunded_amount = refunded_amount + new.amount, status = case when refunded_amount + new.amount >= held_amount - deducted_amount then 'REFUNDED' else 'PARTIALLY_DEDUCTED' end, updated_at = now() where id = d.id;
  end if;
  return new;
end $$;
drop trigger if exists deposit_transaction_apply on public.deposit_transactions;
create trigger deposit_transaction_apply before insert on public.deposit_transactions for each row execute function private.apply_deposit_transaction();
