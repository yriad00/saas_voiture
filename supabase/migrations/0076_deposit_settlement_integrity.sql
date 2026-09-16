-- A deposit deduction may settle an already recorded rental charge.  Keep this
-- flag on the immutable deposit transaction so it is traceable and cannot be
-- counted as revenue or as a second cash payment.
alter table public.deposit_transactions
  add column if not exists settles_balance boolean not null default false;

create index if not exists deposit_transactions_settlement_idx
  on public.deposit_transactions (agency_id, deposit_id, transaction_type, settles_balance, created_at);

create or replace function private.prevent_deposit_transaction_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return coalesce(new, old);
  end if;
  raise exception 'deposit_transaction_immutable' using errcode = '42501';
end;
$$;

revoke all on function private.prevent_deposit_transaction_mutation() from public;
drop trigger if exists deposit_transaction_immutable on public.deposit_transactions;
create trigger deposit_transaction_immutable
before update or delete on public.deposit_transactions
for each row execute function private.prevent_deposit_transaction_mutation();
