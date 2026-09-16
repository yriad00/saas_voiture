-- Owner/sub-rental settlement must remain a real, idempotent financial
-- operation.  The settlement snapshot records the commercial split while
-- the expense ledger records the amount actually paid to the owner.
alter table public.vehicle_owner_settlements
  add column if not exists payment_method public.payment_method not null default 'CASH';

create or replace function public.save_vehicle_owner_settlement(
  p_agency_id uuid,
  p_contract_id uuid,
  p_owner_amount numeric,
  p_paid_amount numeric,
  p_payment_method public.payment_method default 'CASH',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor uuid := auth.uid();
  c record;
  v record;
  current_settlement record;
  settlement_id uuid;
  prior_paid numeric := 0;
  delta numeric := 0;
  status_value text;
  expense_id uuid;
  effective_branch uuid;
begin
  if actor is null
     or not is_agency_member(p_agency_id)
     or not user_has_permission(p_agency_id, 'payments.create') then
    raise exception 'owner_settlement_permission_denied' using errcode = '42501';
  end if;
  if p_owner_amount is null or p_owner_amount < 0
     or p_paid_amount is null or p_paid_amount < 0 then
    raise exception 'owner_settlement_amount_invalid' using errcode = '22003';
  end if;
  if p_paid_amount > p_owner_amount then
    raise exception 'owner_settlement_overpaid' using errcode = '23514';
  end if;

  select c.id, c.agency_id, c.branch_id, c.vehicle_id,
         coalesce(c.final_total_amount, c.total_amount, 0) as rental_revenue
    into c
    from public.contracts c
   where c.id = p_contract_id
     and c.agency_id = p_agency_id
   for update;
  if not found then raise exception 'owner_settlement_contract_not_found' using errcode = '42501'; end if;

  select v.ownership_type, v.owner_name, v.owner_phone
    into v
    from public.vehicles v
   where v.id = c.vehicle_id
     and v.agency_id = p_agency_id
     and v.deleted_at is null;
  if not found or v.ownership_type is distinct from 'SUBLEASE' then
    raise exception 'owner_settlement_vehicle_not_sublease' using errcode = '23514';
  end if;
  effective_branch := c.branch_id;
  if effective_branch is not null and not private.user_can_access_branch(p_agency_id, effective_branch) then
    raise exception 'owner_settlement_branch_scope_mismatch' using errcode = '42501';
  end if;

  select s.id, s.paid_amount
    into current_settlement
    from public.vehicle_owner_settlements s
   where s.agency_id = p_agency_id
     and s.contract_id = c.id
     and s.vehicle_id = c.vehicle_id
   for update;
  if found then
    settlement_id := current_settlement.id;
    prior_paid := round(coalesce(current_settlement.paid_amount, 0), 2);
    if p_paid_amount < prior_paid then
      raise exception 'owner_settlement_paid_amount_decrease' using errcode = '23514';
    end if;
  end if;
  delta := round(p_paid_amount - prior_paid, 2);
  status_value := case
    when p_owner_amount > 0 and p_paid_amount >= p_owner_amount then 'PAID'
    when p_paid_amount > 0 then 'PARTIALLY_PAID'
    else 'UNPAID'
  end;

  if settlement_id is null then
    insert into public.vehicle_owner_settlements (
      agency_id, branch_id, vehicle_id, contract_id, owner_name, owner_contact,
      rental_revenue, owner_amount, agency_margin, paid_amount, payment_method,
      status, paid_at, notes, created_by
    ) values (
      p_agency_id, effective_branch, c.vehicle_id, c.id,
      coalesce(v.owner_name, 'Propriétaire'), v.owner_phone,
      round(c.rental_revenue, 2), round(p_owner_amount, 2),
      round(c.rental_revenue - p_owner_amount, 2), round(p_paid_amount, 2),
      p_payment_method, status_value,
      case when p_paid_amount > 0 then now() else null end,
      nullif(trim(p_notes), ''), actor
    ) returning id into settlement_id;
  else
    update public.vehicle_owner_settlements
       set branch_id = effective_branch,
           owner_name = coalesce(v.owner_name, owner_name, 'Propriétaire'),
           owner_contact = v.owner_phone,
           rental_revenue = round(c.rental_revenue, 2),
           owner_amount = round(p_owner_amount, 2),
           agency_margin = round(c.rental_revenue - p_owner_amount, 2),
           paid_amount = round(p_paid_amount, 2),
           payment_method = p_payment_method,
           status = status_value,
           paid_at = case when p_paid_amount > 0 then coalesce(paid_at, now()) else null end,
           notes = nullif(trim(p_notes), ''),
           updated_at = now()
     where id = settlement_id;
  end if;

  if delta > 0 then
    if not user_has_permission(p_agency_id, 'expenses.create') then
      raise exception 'owner_settlement_expense_permission_denied' using errcode = '42501';
    end if;
    expense_id := public.record_expense_with_cash(
      p_agency_id,
      effective_branch,
      c.vehicle_id,
      'SUBLEASE_OWNER_SETTLEMENT',
      delta,
      current_date,
      p_payment_method,
      coalesce(v.owner_name, 'Propriétaire'),
      coalesce(nullif(trim(p_notes), ''), 'Règlement propriétaire · contrat ' || c.id::text),
      'owner-settlement:' || settlement_id::text || ':' || p_paid_amount::text
    );
  end if;

  return jsonb_build_object(
    'id', settlement_id,
    'paid_amount', round(p_paid_amount, 2),
    'paid_delta', delta,
    'status', status_value,
    'expense_id', expense_id,
    'replayed', delta = 0 and settlement_id is not null and prior_paid = p_paid_amount
  );
end;
$$;

revoke all on function public.save_vehicle_owner_settlement(uuid, uuid, numeric, numeric, public.payment_method, text) from public, anon;
grant execute on function public.save_vehicle_owner_settlement(uuid, uuid, numeric, numeric, public.payment_method, text) to authenticated;
