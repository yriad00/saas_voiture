-- Supabase service-key PostgREST calls may expose as an API role without a
-- JWT role claim. Keep ordinary authenticated users out by requiring no user
-- identity, while retaining the synthetic agency marker check.
create or replace function public.cleanup_test_agency(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  agency_name text;
  removed_id uuid;
begin
  if auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role'
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'test_cleanup_service_role_required' using errcode = '42501';
  end if;
  select a.name into agency_name from public.agencies a where a.id = p_agency_id;
  if agency_name is null
     or (agency_name not like 'FleetHub Security %' and agency_name not like 'TEST_E2E_%') then
    raise exception 'test_cleanup_marker_required' using errcode = '42501';
  end if;
  alter table public.deposit_transactions disable trigger deposit_transaction_immutable;
  begin
    delete from public.vehicle_transfers where agency_id = p_agency_id;
    delete from public.delivery_missions where agency_id = p_agency_id;
    delete from public.cash_movements where agency_id = p_agency_id;
    delete from public.cash_sessions where agency_id = p_agency_id;
    delete from public.deposit_transactions where agency_id = p_agency_id;
    delete from public.deposits where agency_id = p_agency_id;
    delete from public.fines where agency_id = p_agency_id;
    delete from public.accident_photos where agency_id = p_agency_id;
    delete from public.accident_damages where agency_id = p_agency_id;
    delete from public.accidents where agency_id = p_agency_id;
    delete from public.damage_photos where agency_id = p_agency_id;
    delete from public.damage_records where agency_id = p_agency_id;
    delete from public.return_charge_override_history where agency_id = p_agency_id;
    delete from public.return_charges where agency_id = p_agency_id;
    delete from public.contract_inspection_photos where agency_id = p_agency_id;
    delete from public.contract_inspections where agency_id = p_agency_id;
    delete from public.contract_signatures where agency_id = p_agency_id;
    delete from public.contract_checkins where agency_id = p_agency_id;
    delete from public.vehicle_swaps where agency_id = p_agency_id;
    delete from public.rental_extensions where agency_id = p_agency_id;
    delete from public.active_rental_updates where agency_id = p_agency_id;
    delete from public.contract_checkouts where agency_id = p_agency_id;
    delete from public.vehicle_preparations where agency_id = p_agency_id;
    delete from public.pricing_override_history where agency_id = p_agency_id;
    delete from public.contract_extras where agency_id = p_agency_id;
    delete from public.reservation_extras where agency_id = p_agency_id;
    delete from public.extras_catalog where agency_id = p_agency_id;
    delete from public.pricing_rules where agency_id = p_agency_id;
    delete from public.promotions where agency_id = p_agency_id;
    delete from public.vehicle_blocks where agency_id = p_agency_id;
    delete from public.vehicle_documents where agency_id = p_agency_id;
    delete from public.customer_documents where agency_id = p_agency_id;
    delete from public.customer_risk_flags where agency_id = p_agency_id;
    delete from public.rental_participants where agency_id = p_agency_id;
    delete from public.vehicle_owner_settlements where agency_id = p_agency_id;
    delete from public.audit_logs where agency_id = p_agency_id;
    delete from public.leads where agency_id = p_agency_id;
    delete from public.invoices where agency_id = p_agency_id;
    delete from public.payments where agency_id = p_agency_id;
    delete from public.expenses where agency_id = p_agency_id;
    delete from public.maintenance_records where agency_id = p_agency_id;
    delete from public.contracts where agency_id = p_agency_id;
    delete from public.reservations where agency_id = p_agency_id;
    delete from public.customers where agency_id = p_agency_id;
    delete from public.vehicles where agency_id = p_agency_id;
  exception when others then
    alter table public.deposit_transactions enable trigger deposit_transaction_immutable;
    raise;
  end;
  alter table public.deposit_transactions enable trigger deposit_transaction_immutable;
  delete from public.agency_members where agency_id = p_agency_id;
  delete from public.agency_settings where agency_id = p_agency_id;
  delete from public.subscriptions where agency_id = p_agency_id;
  delete from public.branches where agency_id = p_agency_id;
  delete from public.agencies where id = p_agency_id returning id into removed_id;
  return jsonb_build_object('agency_id', removed_id, 'removed', removed_id is not null);
end;
$$;
