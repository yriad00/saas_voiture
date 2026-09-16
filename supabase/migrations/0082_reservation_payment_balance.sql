-- Keep the reservation's displayed remaining balance tied to the same
-- completed payment ledger used by cancellation/no-show refunds.
create or replace function private.refresh_reservation_payment_balance()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_reservation uuid := coalesce(new.reservation_id, old.reservation_id);
begin
  if target_reservation is null then
    return coalesce(new, old);
  end if;

  update public.reservations r
     set remaining_amount = greatest(0, round(r.total_amount - coalesce((
       select sum(case
         when p.type in ('RENTAL', 'PENALTY', 'EXTRA') then p.amount
         when p.type = 'REFUND' then -p.amount
         else 0
       end)
       from public.payments p
       where p.agency_id = r.agency_id
         and p.reservation_id = r.id
         and p.status = 'COMPLETED'
     ), 0), 2)), updated_at = now()
   where r.id = target_reservation;

  return coalesce(new, old);
end;
$$;

revoke all on function private.refresh_reservation_payment_balance() from public;
drop trigger if exists payments_reservation_balance on public.payments;
create trigger payments_reservation_balance
  after insert or update of reservation_id, amount, type, status or delete
  on public.payments
  for each row execute function private.refresh_reservation_payment_balance();

create index if not exists payments_reservation_balance_idx
  on public.payments (reservation_id, status, type)
  where reservation_id is not null;
