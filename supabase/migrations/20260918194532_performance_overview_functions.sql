-- Performance read model for the agency command centre.
--
-- Both functions are SECURITY INVOKER on purpose: all existing tenant and
-- branch RLS policies remain the authorization boundary.  They only aggregate
-- rows already visible to the caller and never expose financial data outside
-- that caller's scope.

create or replace function public.get_today_overview(
  p_agency_id uuid,
  p_branch_id uuid default null,
  p_current_date date default current_date
)
returns jsonb
language sql
stable
security invoker
set search_path = public, private
as $$
with access as (
  select is_agency_member(p_agency_id)
    and (p_branch_id is null or private.user_can_access_branch(p_agency_id, p_branch_id)) as allowed
),
departures as (
  select jsonb_build_object(
    'id', r.id,
    'reference', r.reference,
    'customer_id', r.customer_id,
    'customer_name', concat_ws(' ', c.first_name, c.last_name),
    'vehicle_id', r.vehicle_id,
    'vehicle_name', case when v.id is null then null else concat_ws(' ', v.brand, v.model, '·', v.license_plate) end,
    'start_date', r.start_date,
    'end_date', r.end_date
  ) as row
  from reservations r
  join customers c on c.id = r.customer_id and c.agency_id = r.agency_id
  left join vehicles v on v.id = r.vehicle_id and v.agency_id = r.agency_id
  cross join access a
  where a.allowed
    and r.agency_id = p_agency_id
    and r.start_date = p_current_date
    and r.status in ('CONFIRMED', 'ONGOING')
    and (
      p_branch_id is null
      or r.branch_id = p_branch_id
      or r.pickup_branch_id = p_branch_id
    )
  order by r.start_date, r.created_at
  limit 20
),
returns as (
  select jsonb_build_object(
    'id', c.id,
    'contract_number', c.contract_number,
    'customer_id', c.customer_id,
    'customer_name', concat_ws(' ', cu.first_name, cu.last_name),
    'vehicle_id', c.vehicle_id,
    'vehicle_name', concat_ws(' ', v.brand, v.model, '·', v.license_plate),
    'end_date', c.end_date
  ) as row
  from contracts c
  join customers cu on cu.id = c.customer_id and cu.agency_id = c.agency_id
  join vehicles v on v.id = c.vehicle_id and v.agency_id = c.agency_id
  cross join access a
  where a.allowed
    and c.agency_id = p_agency_id
    and c.end_date = p_current_date
    and c.status = 'ACTIVE'
    and (
      p_branch_id is null
      or c.branch_id = p_branch_id
      or c.return_branch_id = p_branch_id
    )
  order by c.end_date, c.created_at
  limit 20
),
preparations as (
  select jsonb_build_object(
    'id', vp.id,
    'contract_id', vp.contract_id,
    'contract_number', c.contract_number,
    'status', vp.status
  ) as row
  from vehicle_preparations vp
  left join contracts c on c.id = vp.contract_id and c.agency_id = vp.agency_id
  cross join access a
  where a.allowed
    and vp.agency_id = p_agency_id
    and vp.status in ('IN_PROGRESS', 'BLOCKED')
    and (p_branch_id is null or vp.branch_id = p_branch_id)
  order by vp.updated_at desc
  limit 20
),
missions as (
  select jsonb_build_object(
    'id', m.id,
    'mission_type', m.mission_type,
    'address', m.address,
    'scheduled_at', m.scheduled_at,
    'status', m.status,
    'vehicle_id', m.vehicle_id,
    'vehicle_name', case when v.id is null then null else concat_ws(' ', v.brand, v.model, '·', v.license_plate) end,
    'customer_id', m.customer_id,
    'customer_name', case when cu.id is null then null else concat_ws(' ', cu.first_name, cu.last_name) end
  ) as row
  from delivery_missions m
  left join vehicles v on v.id = m.vehicle_id and v.agency_id = m.agency_id
  left join customers cu on cu.id = m.customer_id and cu.agency_id = m.agency_id
  cross join access a
  where a.allowed
    and m.agency_id = p_agency_id
    and m.scheduled_at >= (p_current_date::timestamp at time zone 'Africa/Casablanca')
    and m.scheduled_at < ((p_current_date + 1)::timestamp at time zone 'Africa/Casablanca')
    and m.status in ('PLANNED', 'PREPARING', 'READY', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED')
    and (p_branch_id is null or m.branch_id = p_branch_id or m.branch_id is null)
  order by m.scheduled_at
  limit 20
),
deposit_rows as (
  select jsonb_build_object(
    'id', d.id,
    'contract_id', d.contract_id,
    'contract_number', c.contract_number,
    'status', d.status,
    'held_amount', d.held_amount
  ) as row
  from deposits d
  left join contracts c on c.id = d.contract_id and c.agency_id = d.agency_id
  cross join access a
  where a.allowed
    and d.agency_id = p_agency_id
    and d.status in ('RECEIVED', 'HELD', 'PARTIALLY_DEDUCTED')
    and (p_branch_id is null or d.branch_id = p_branch_id or d.branch_id is null)
  order by d.updated_at desc
  limit 20
),
urgent_alerts as (
  select jsonb_build_object(
    'id', v.id,
    'title', concat(v.brand, ' ', v.model),
    'subtitle', concat('Document véhicule à vérifier · ', v.license_plate),
    'href', concat('/agency/fleet/', v.id),
    'tone', 'warning'
  ) as row
  from vehicles v
  cross join access a
  where a.allowed and v.agency_id = p_agency_id and v.deleted_at is null
    and (p_branch_id is null or v.branch_id = p_branch_id)
    and (
      (v.insurance_expiry is not null and v.insurance_expiry <= p_current_date + 30)
      or (v.technical_inspection_expiry is not null and v.technical_inspection_expiry <= p_current_date + 30)
    )
  union all
  select jsonb_build_object(
    'id', cu.id,
    'title', concat_ws(' ', cu.first_name, cu.last_name),
    'subtitle', 'Pièce d’identité ou permis à vérifier',
    'href', concat('/agency/customers/', cu.id),
    'tone', 'warning'
  )
  from customers cu
  cross join access a
  where a.allowed and cu.agency_id = p_agency_id and cu.deleted_at is null
    and (
      (cu.id_expiry is not null and cu.id_expiry <= p_current_date + 30)
      or (cu.driver_license_expiry is not null and cu.driver_license_expiry <= p_current_date + 30)
      or (cu.passport_expiry is not null and cu.passport_expiry <= p_current_date + 30)
    )
  union all
  select jsonb_build_object(
    'id', vd.id,
    'title', concat_ws(' ', v.brand, v.model, '·', v.license_plate),
    'subtitle', concat('Document véhicule à vérifier · expire le ', vd.expires_at),
    'href', concat('/agency/fleet/', v.id),
    'tone', 'warning'
  )
  from vehicle_documents vd
  join vehicles v on v.id = vd.vehicle_id and v.agency_id = vd.agency_id
  cross join access a
  where a.allowed and vd.agency_id = p_agency_id and vd.expires_at is not null and vd.expires_at <= p_current_date + 30
    and (p_branch_id is null or v.branch_id = p_branch_id)
  union all
  select jsonb_build_object(
    'id', cd.id,
    'title', concat_ws(' ', cu.first_name, cu.last_name),
    'subtitle', concat('Document client à vérifier · expire le ', cd.expires_at),
    'href', concat('/agency/customers/', cu.id),
    'tone', 'warning'
  )
  from customer_documents cd
  join customers cu on cu.id = cd.customer_id and cu.agency_id = cd.agency_id
  cross join access a
  where a.allowed and cd.agency_id = p_agency_id and cd.expires_at is not null and cd.expires_at <= p_current_date + 30
),
maintenance_alerts as (
  select jsonb_build_object(
    'id', m.id,
    'title', concat_ws(' ', v.brand, v.model, '·', v.license_plate),
    'subtitle', concat('Entretien à prévoir le ', coalesce(m.next_service_date::text, 'bientôt')),
    'href', '/agency/maintenance',
    'tone', 'warning'
  ) as row
  from maintenance_records m
  join vehicles v on v.id = m.vehicle_id and v.agency_id = m.agency_id
  cross join access a
  where a.allowed and m.agency_id = p_agency_id and m.status = 'SCHEDULED'
    and m.next_service_date <= p_current_date + 1
    and (p_branch_id is null or m.branch_id = p_branch_id)
  order by m.next_service_date
  limit 20
),
contract_paid as (
  select p.contract_id,
    sum(case when p.status = 'COMPLETED' and p.type not in ('DEPOSIT', 'DEPOSIT_REFUND') then
      case when p.type = 'REFUND' then -p.amount else p.amount end else 0 end) as paid
  from payments p
  cross join access a
  where a.allowed and p.agency_id = p_agency_id and p.contract_id is not null
    and (p_branch_id is null or p.branch_id = p_branch_id or p.branch_id is null)
  group by p.contract_id
),
reservation_paid as (
  select p.reservation_id,
    sum(case when p.status = 'COMPLETED' and p.type not in ('DEPOSIT', 'DEPOSIT_REFUND') then
      case when p.type = 'REFUND' then -p.amount else p.amount end else 0 end) as paid
  from payments p
  cross join access a
  where a.allowed and p.agency_id = p_agency_id and p.reservation_id is not null
    and (p_branch_id is null or p.branch_id = p_branch_id or p.branch_id is null)
  group by p.reservation_id
),
active_contract_balances as (
  select c.id,
    greatest(0, coalesce(c.final_total_amount, c.total_amount + c.extras_total + c.return_charges_total) - coalesce(cp.paid, 0)) as amount_due
  from contracts c
  left join contract_paid cp on cp.contract_id = c.id
  cross join access a
  where a.allowed and c.agency_id = p_agency_id and c.status = 'ACTIVE'
    and (p_branch_id is null or c.branch_id = p_branch_id or c.return_branch_id = p_branch_id)
),
open_reservation_balances as (
  select r.id,
    greatest(0, r.total_amount - coalesce(rp.paid, 0)) as amount_due
  from reservations r
  left join reservation_paid rp on rp.reservation_id = r.id
  cross join access a
  where a.allowed and r.agency_id = p_agency_id and r.status in ('PENDING', 'CONFIRMED')
    and (p_branch_id is null or r.branch_id = p_branch_id or r.pickup_branch_id = p_branch_id)
    and not exists (select 1 from contracts c where c.reservation_id = r.id and c.agency_id = r.agency_id)
),
metrics as (
  select
    (select count(*) from departures) as pickups_today,
    (select count(*) from returns) as returns_today,
    (select count(*) from active_contract_balances where amount_due > 0) as active_balances_count,
    (select coalesce(sum(amount_due), 0) from active_contract_balances) + (select coalesce(sum(amount_due), 0) from open_reservation_balances) as unpaid_balances,
    (select count(*) from contracts c cross join access a where a.allowed and c.agency_id = p_agency_id and c.status = 'ACTIVE' and c.end_date < p_current_date and (p_branch_id is null or c.branch_id = p_branch_id or c.return_branch_id = p_branch_id)) as late_returns,
    (select coalesce(sum(greatest(0, d.held_amount - d.deducted_amount - d.refunded_amount)), 0) from deposits d cross join access a where a.allowed and d.agency_id = p_agency_id and (p_branch_id is null or d.branch_id = p_branch_id or d.branch_id is null)) as deposits_held,
    (select count(*) from urgent_alerts) + (select count(*) from maintenance_alerts) as document_alerts
)
select jsonb_build_object(
  'metrics', jsonb_build_object(
    'pickups_today', pickups_today,
    'returns_today', returns_today,
    'late_returns', late_returns,
    'unpaid_balances', round(unpaid_balances, 2),
    'deposits_held', round(deposits_held, 2),
    'document_alerts', document_alerts
  ),
  'departures', coalesce((select jsonb_agg(row) from departures), '[]'::jsonb),
  'returns', coalesce((select jsonb_agg(row) from returns), '[]'::jsonb),
  'preparations', coalesce((select jsonb_agg(row) from preparations), '[]'::jsonb),
  'missions', coalesce((select jsonb_agg(row) from missions), '[]'::jsonb),
  'deposits', coalesce((select jsonb_agg(row) from deposit_rows), '[]'::jsonb),
  'alerts', coalesce((select jsonb_agg(row) from (select row from maintenance_alerts union all select row from urgent_alerts limit 20) limited_alerts), '[]'::jsonb)
)
from metrics;
$$;

revoke all on function public.get_today_overview(uuid, uuid, date) from public;
grant execute on function public.get_today_overview(uuid, uuid, date) to authenticated;

create or replace function public.get_dashboard_summary(
  p_agency_id uuid,
  p_branch_id uuid default null,
  p_current_date date default current_date
)
returns jsonb
language sql
stable
security invoker
set search_path = public, private
as $$
with access as (
  select is_agency_member(p_agency_id)
    and (p_branch_id is null or private.user_can_access_branch(p_agency_id, p_branch_id)) as allowed
),
agency_tz as (
  select coalesce(a.timezone, 'Africa/Casablanca') as timezone
  from agencies a cross join access x
  where x.allowed and a.id = p_agency_id
  limit 1
),
vehicles_scope as (
  select v.* from vehicles v cross join access x
  where x.allowed and v.agency_id = p_agency_id and v.deleted_at is null
    and (p_branch_id is null or v.branch_id = p_branch_id)
),
reservations_scope as (
  select r.* from reservations r cross join access x
  where x.allowed and r.agency_id = p_agency_id
    and (p_branch_id is null or r.branch_id = p_branch_id or r.pickup_branch_id = p_branch_id)
),
contracts_scope as (
  select c.* from contracts c cross join access x
  where x.allowed and c.agency_id = p_agency_id
    and (p_branch_id is null or c.branch_id = p_branch_id or c.return_branch_id = p_branch_id)
),
payments_scope as (
  select p.* from payments p cross join access x
  where x.allowed and p.agency_id = p_agency_id
    and (p_branch_id is null or p.branch_id = p_branch_id or p.branch_id is null)
),
deposits_scope as (
  select d.* from deposits d cross join access x
  where x.allowed and d.agency_id = p_agency_id
    and (p_branch_id is null or d.branch_id = p_branch_id or d.branch_id is null)
),
maintenance_scope as (
  select m.* from maintenance_records m cross join access x
  where x.allowed and m.agency_id = p_agency_id
    and (p_branch_id is null or m.branch_id = p_branch_id)
),
expenses_scope as (
  select e.* from expenses e cross join access x
  where x.allowed and e.agency_id = p_agency_id
    and (p_branch_id is null or e.branch_id = p_branch_id or e.branch_id is null)
),
contract_paid as (
  select p.contract_id,
    sum(case when p.status = 'COMPLETED' and p.type not in ('DEPOSIT', 'DEPOSIT_REFUND') then case when p.type = 'REFUND' then -p.amount else p.amount end else 0 end) as paid
  from payments_scope p where p.contract_id is not null group by p.contract_id
),
reservation_paid as (
  select p.reservation_id,
    sum(case when p.status = 'COMPLETED' and p.type not in ('DEPOSIT', 'DEPOSIT_REFUND') then case when p.type = 'REFUND' then -p.amount else p.amount end else 0 end) as paid
  from payments_scope p where p.reservation_id is not null group by p.reservation_id
),
today_payment_totals as (
  select coalesce(sum(case when p.type in ('REFUND', 'DEPOSIT_REFUND') then -p.amount else p.amount end), 0) as value
  from payments_scope p
  where p.status = 'COMPLETED' and p.type not in ('DEPOSIT', 'DEPOSIT_REFUND')
    and (p.paid_at at time zone (select timezone from agency_tz))::date = p_current_date
),
month_payment_totals as (
  select coalesce(sum(case when p.type in ('REFUND', 'DEPOSIT_REFUND') then -p.amount else p.amount end), 0) as value
  from payments_scope p
  where p.status = 'COMPLETED' and p.type not in ('DEPOSIT', 'DEPOSIT_REFUND')
    and (p.paid_at at time zone (select timezone from agency_tz))::date >= date_trunc('month', p_current_date::timestamp)::date
    and (p.paid_at at time zone (select timezone from agency_tz))::date < (date_trunc('month', p_current_date::timestamp) + interval '1 month')::date
),
week_payment_totals as (
  select coalesce(sum(case when p.type in ('REFUND', 'DEPOSIT_REFUND') then -p.amount else p.amount end), 0) as value
  from payments_scope p
  where p.status = 'COMPLETED' and p.type not in ('DEPOSIT', 'DEPOSIT_REFUND')
    and (p.paid_at at time zone (select timezone from agency_tz))::date >= p_current_date - (extract(isodow from p_current_date)::int - 1)
    and (p.paid_at at time zone (select timezone from agency_tz))::date <= p_current_date
),
unpaid as (
  select coalesce(sum(greatest(0, coalesce(c.final_total_amount, c.total_amount + c.extras_total + c.return_charges_total) - coalesce(cp.paid, 0))), 0) as value
  from contracts_scope c left join contract_paid cp on cp.contract_id = c.id
  where c.status = 'ACTIVE'
  union all
  select coalesce(sum(greatest(0, r.total_amount - coalesce(rp.paid, 0))), 0)
  from reservations_scope r left join reservation_paid rp on rp.reservation_id = r.id
  where r.status in ('PENDING', 'CONFIRMED') and not exists (select 1 from contracts_scope c where c.reservation_id = r.id)
),
expense_totals as (
  select coalesce(sum(e.amount), 0) as value from expenses_scope e
  where e.expense_date >= date_trunc('month', p_current_date::timestamp)::date
    and e.expense_date < (date_trunc('month', p_current_date::timestamp) + interval '1 month')::date
  union all
  select coalesce(sum(m.cost), 0) from maintenance_scope m
  where m.status = 'COMPLETED'
    and m.service_date >= date_trunc('month', p_current_date::timestamp)::date
    and m.service_date < (date_trunc('month', p_current_date::timestamp) + interval '1 month')::date
),
alerts as (
  select jsonb_build_object('severity', case when v.insurance_expiry < p_current_date or v.technical_inspection_expiry < p_current_date then 'critical' else 'warning' end, 'title', concat('Document véhicule : ', v.brand, ' ', v.model), 'description', v.license_plate, 'href', concat('/agency/fleet/', v.id)) as row
  from vehicles_scope v
  where (v.insurance_expiry is not null and v.insurance_expiry <= p_current_date + 30)
     or (v.technical_inspection_expiry is not null and v.technical_inspection_expiry <= p_current_date + 30)
  union all
  select jsonb_build_object('severity', 'warning', 'title', 'Entretien à planifier', 'description', concat_ws(' ', v.brand, v.model, v.license_plate), 'href', '/agency/maintenance')
  from maintenance_scope m join vehicles_scope v on v.id = m.vehicle_id
  where m.status = 'SCHEDULED' and m.next_service_date <= p_current_date + 7
  union all
  select jsonb_build_object('severity', 'critical', 'title', concat(count(*), ' retour(s) en retard'), 'description', 'Vérifiez les contrats et contactez les clients concernés.', 'href', '/agency/contracts')
  from contracts_scope c where c.status = 'ACTIVE' and c.end_date < p_current_date having count(*) > 0
),
fleet_counts as (
  select count(*) total,
    count(*) filter (where v.status = 'AVAILABLE') available,
    count(*) filter (where v.status = 'RENTED') rented,
    count(*) filter (where v.status = 'RESERVED') reserved,
    count(*) filter (where v.status = 'MAINTENANCE') maintenance,
    count(*) filter (where v.status = 'OUT_OF_SERVICE') unavailable
  from vehicles_scope v
),
unpaid_total as (select coalesce(sum(value), 0) as value from unpaid),
expense_total as (select coalesce(sum(value), 0) as value from expense_totals)
select jsonb_build_object(
  'timezone', coalesce((select timezone from agency_tz), 'Africa/Casablanca'),
  'metrics', jsonb_build_object(
    'totalVehicles', fc.total,
    'availableVehicles', fc.available,
    'rentedVehicles', fc.rented,
    'reservedVehicles', fc.reserved,
    'maintenanceVehicles', fc.maintenance,
    'unavailableVehicles', fc.unavailable,
    'reservationsToday', (select count(*) from reservations_scope r where r.status in ('CONFIRMED', 'ONGOING') and r.start_date <= p_current_date and r.end_date >= p_current_date),
    'pickupsToday', (select count(*) from reservations_scope r where r.status in ('CONFIRMED', 'ONGOING') and r.start_date = p_current_date),
    'returnsToday', (select count(*) from reservations_scope r where r.status in ('CONFIRMED', 'ONGOING') and r.end_date = p_current_date),
    'lateReturns', (select count(*) from contracts_scope c where c.status = 'ACTIVE' and c.end_date < p_current_date),
    'activeRentals', (select count(*) from contracts_scope c where c.status = 'ACTIVE'),
    'pendingReservations', (select count(*) from reservations_scope r where r.status = 'PENDING'),
    'unpaidBalances', round((select value from unpaid_total), 2),
    'depositsHeld', round((select coalesce(sum(greatest(0, d.held_amount - d.deducted_amount - d.refunded_amount)), 0) from deposits_scope d), 2),
    'revenueToday', round((select value from today_payment_totals), 2),
    'revenueWeek', round((select value from week_payment_totals), 2),
    'revenueMonth', round((select value from month_payment_totals), 2),
    'expensesMonth', round((select value from expense_total), 2),
    'netProfitMonth', round((select value from month_payment_totals) - (select value from expense_total), 2),
    'utilizationRate', case when fc.total = 0 then 0 else round((select count(*) from contracts_scope c where c.status = 'ACTIVE') * 100.0 / fc.total)::int end
  ),
  'alerts', coalesce((select jsonb_agg(row) from (select row from alerts limit 10) limited), '[]'::jsonb)
)
from fleet_counts fc;
$$;

revoke all on function public.get_dashboard_summary(uuid, uuid, date) from public;
grant execute on function public.get_dashboard_summary(uuid, uuid, date) to authenticated;
