-- P0 tenant and permission hardening.
-- UPDATE policies must constrain both the existing row and the resulting row;
-- otherwise a client could move an owned record to another agency by changing
-- agency_id through the Data API.

drop policy if exists member_insert on public.contracts;
create policy member_insert on public.contracts
  for insert with check (
    is_super_admin()
    or (is_agency_member(agency_id) and user_has_permission(agency_id, 'contracts:write'))
  );

drop policy if exists member_update on public.contracts;
create policy member_update on public.contracts
  for update
  using (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'contracts:write')))
  with check (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'contracts:write')));

drop policy if exists member_insert on public.customers;
create policy member_insert on public.customers
  for insert with check (
    is_super_admin()
    or (is_agency_member(agency_id) and user_has_permission(agency_id, 'customers:write'))
  );

drop policy if exists member_update on public.customers;
create policy member_update on public.customers
  for update
  using (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'customers:write')))
  with check (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'customers:write')));

drop policy if exists member_insert on public.maintenance_records;
create policy member_insert on public.maintenance_records
  for insert with check (
    is_super_admin()
    or (is_agency_member(agency_id) and user_has_permission(agency_id, 'maintenance:write'))
  );

drop policy if exists member_update on public.maintenance_records;
create policy member_update on public.maintenance_records
  for update
  using (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'maintenance:write')))
  with check (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'maintenance:write')));

drop policy if exists member_insert on public.payments;
create policy member_insert on public.payments
  for insert with check (
    is_super_admin()
    or (is_agency_member(agency_id) and user_has_permission(agency_id, 'payments:write'))
  );

drop policy if exists member_update on public.payments;
create policy member_update on public.payments
  for update
  using (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'payments:write')))
  with check (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'payments:write')));

drop policy if exists member_insert on public.reservations;
create policy member_insert on public.reservations
  for insert with check (
    is_super_admin()
    or (is_agency_member(agency_id) and user_has_permission(agency_id, 'reservations:write'))
  );

drop policy if exists member_update on public.reservations;
create policy member_update on public.reservations
  for update
  using (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'reservations:write')))
  with check (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'reservations:write')));

drop policy if exists agency_member_insert on public.vehicles;
create policy agency_member_insert on public.vehicles
  for insert with check (
    is_super_admin()
    or (is_agency_member(agency_id) and user_has_permission(agency_id, 'fleet:write'))
  );

drop policy if exists agency_member_update on public.vehicles;
create policy agency_member_update on public.vehicles
  for update
  using (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'fleet:write')))
  with check (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'fleet:write')));

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
  for insert with check (
    is_super_admin()
    or (is_agency_member(agency_id) and user_has_permission(agency_id, 'expenses.create'))
  );

drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices
  for insert with check (
    is_super_admin()
    or (is_agency_member(agency_id) and user_has_permission(agency_id, 'invoices.create'))
  );

drop policy if exists contract_inspections_insert on public.contract_inspections;
create policy contract_inspections_insert on public.contract_inspections
  for insert with check (
    is_super_admin()
    or (is_agency_member(agency_id) and user_has_permission(agency_id, 'contracts:write'))
  );

drop policy if exists contract_inspection_photos_insert on public.contract_inspection_photos;
create policy contract_inspection_photos_insert on public.contract_inspection_photos
  for insert with check (
    is_super_admin()
    or (is_agency_member(agency_id) and user_has_permission(agency_id, 'contracts:write'))
  );

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
  for insert with check (
    is_super_admin()
    or (
      agency_id is not null
      and is_agency_member(agency_id)
      and actor_id = auth.uid()
    )
  );
