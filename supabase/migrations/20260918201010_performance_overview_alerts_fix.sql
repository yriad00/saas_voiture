-- Preserve dashboard document alerts in the aggregated read model.
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
customers_scope as (
  select cu.* from customers cu cross join access x
  where x.allowed and cu.agency_id = p_agency_id and cu.deleted_at is null
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
  select jsonb_build_object('severity', case when cu.id_expiry < p_current_date or cu.driver_license_expiry < p_current_date or cu.passport_expiry < p_current_date then 'critical' else 'warning' end, 'title', concat('Document client : ', cu.first_name, ' ', cu.last_name), 'description', 'Pièce d’identité ou permis à vérifier', 'href', concat('/agency/customers/', cu.id))
  from customers_scope cu
  where (cu.id_expiry is not null and cu.id_expiry <= p_current_date + 30)
     or (cu.driver_license_expiry is not null and cu.driver_license_expiry <= p_current_date + 30)
     or (cu.passport_expiry is not null and cu.passport_expiry <= p_current_date + 30)
  union all
  select jsonb_build_object('severity', case when vd.expires_at < p_current_date then 'critical' else 'warning' end, 'title', concat('Document véhicule : ', v.brand, ' ', v.model), 'description', concat('Expire le ', vd.expires_at), 'href', concat('/agency/fleet/', v.id))
  from vehicle_documents vd join vehicles_scope v on v.id = vd.vehicle_id
  where vd.agency_id = p_agency_id and vd.expires_at is not null and vd.expires_at <= p_current_date + 30
  union all
  select jsonb_build_object('severity', case when cd.expires_at < p_current_date then 'critical' else 'warning' end, 'title', concat('Document client : ', cu.first_name, ' ', cu.last_name), 'description', concat('Expire le ', cd.expires_at), 'href', concat('/agency/customers/', cu.id))
  from customer_documents cd join customers_scope cu on cu.id = cd.customer_id
  where cd.agency_id = p_agency_id and cd.expires_at is not null and cd.expires_at <= p_current_date + 30
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

