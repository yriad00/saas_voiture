-- Complete branch isolation for operational records that were introduced before branches.
-- The private helper keeps branch membership checks out of the public API schema.

drop policy if exists member_select on public.maintenance_records;
create policy member_select on public.maintenance_records
  for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists member_insert on public.maintenance_records;
create policy member_insert on public.maintenance_records
  for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'fleet:write')));
drop policy if exists member_update on public.maintenance_records;
create policy member_update on public.maintenance_records
  for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'fleet:write')))
  with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'fleet:write')));
drop policy if exists member_delete on public.maintenance_records;
create policy member_delete on public.maintenance_records
  for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'fleet:write')));

drop policy if exists contract_inspections_select on public.contract_inspections;
create policy contract_inspections_select on public.contract_inspections
  for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists contract_inspections_insert on public.contract_inspections;
create policy contract_inspections_insert on public.contract_inspections
  for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists contract_inspections_update on public.contract_inspections;
create policy contract_inspections_update on public.contract_inspections
  for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)))
  with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists contract_inspections_delete on public.contract_inspections;
create policy contract_inspections_delete on public.contract_inspections
  for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));

drop policy if exists contract_inspection_photos_select on public.contract_inspection_photos;
create policy contract_inspection_photos_select on public.contract_inspection_photos
  for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists contract_inspection_photos_insert on public.contract_inspection_photos;
create policy contract_inspection_photos_insert on public.contract_inspection_photos
  for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists contract_inspection_photos_update on public.contract_inspection_photos;
create policy contract_inspection_photos_update on public.contract_inspection_photos
  for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)))
  with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists contract_inspection_photos_delete on public.contract_inspection_photos;
create policy contract_inspection_photos_delete on public.contract_inspection_photos
  for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));

drop policy if exists contract_photos_storage_select on storage.objects;
create policy contract_photos_storage_select on storage.objects
  for select to authenticated using (
    bucket_id = 'contract-photos'
    and exists (
      select 1 from public.contract_inspection_photos p
      where p.storage_path = name
        and private.user_can_access_branch(p.agency_id, p.branch_id)
    )
  );
drop policy if exists contract_photos_storage_insert on storage.objects;
create policy contract_photos_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'contract-photos'
    and exists (
      select 1 from public.contracts c
      where c.id = case when name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/' then split_part(name, '/', 2)::uuid else null end
        and private.user_can_access_branch(c.agency_id, c.branch_id)
    )
  );

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select using (is_super_admin() or (agency_id is not null and is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id, branch_id))));
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
  for insert with check (is_super_admin() or (agency_id is not null and is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id, branch_id))));
