-- Reservation advances are an expected amount until a payment is recorded.
-- The displayed balance must therefore come only from the completed payment
-- ledger, including when extras or one-way fees are recalculated.
create or replace function private.recalculate_reservation_extras()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_id uuid := coalesce(new.reservation_id, old.reservation_id);
  extra_total numeric;
begin
  select coalesce(sum(e.total_amount), 0)
    into extra_total
    from public.reservation_extras e
   where e.reservation_id = target_id;

  update public.reservations r
     set extras_total = extra_total,
         total_amount = r.base_total_amount + extra_total + r.one_way_fee,
         remaining_amount = greatest(0, round(
           r.base_total_amount + extra_total + r.one_way_fee - coalesce((
             select sum(case
               when p.type in ('RENTAL', 'PENALTY', 'EXTRA') then p.amount
               when p.type = 'REFUND' then -p.amount
               else 0
             end)
             from public.payments p
             where p.agency_id = r.agency_id
               and p.reservation_id = r.id
               and p.status = 'COMPLETED'
           ), 0), 2)),
         updated_at = now()
   where r.id = target_id;
  return coalesce(new, old);
end;
$$;

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
   ), 0), 2));
