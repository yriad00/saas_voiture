-- Keep an aller-simple fee when extras are added or removed.  The 0061
-- recalculation previously rebuilt the total using only base price + extras.
create or replace function private.recalculate_reservation_extras()
returns trigger language plpgsql security definer set search_path = public, private
as $$
declare
  target_id uuid;
  extra_total numeric;
begin
  target_id := coalesce(new.reservation_id, old.reservation_id);
  select coalesce(sum(e.total_amount), 0)
    into extra_total
    from public.reservation_extras e
   where e.reservation_id = target_id;

  update public.reservations r
     set extras_total = extra_total,
         total_amount = r.base_total_amount + extra_total + r.one_way_fee,
         remaining_amount = greatest(0, r.base_total_amount + extra_total + r.one_way_fee - r.advance_amount),
         updated_at = now()
   where r.id = target_id;
  return coalesce(new, old);
end;
$$;
