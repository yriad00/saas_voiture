-- 0073: allow an authorized return branch to operate a one-way rental.
-- This is a security-preserving read path: pickup-branch writes remain protected,
-- while the destination branch can load the active rental and create return rows.

create policy contracts_one_way_return_select on public.contracts
  for select to authenticated
  using (
    is_super_admin()
    or (
      is_agency_member(agency_id)
      and return_branch_id is not null
      and private.user_can_access_branch(agency_id, return_branch_id)
    )
  );

create policy vehicles_one_way_return_select on public.vehicles
  for select to authenticated
  using (
    is_super_admin()
    or exists (
      select 1
      from public.contracts c
      where c.agency_id = vehicles.agency_id
        and c.vehicle_id = vehicles.id
        and c.status = 'ACTIVE'
        and c.return_branch_id is not null
        and private.user_can_access_branch(c.agency_id, c.return_branch_id)
    )
  );

create policy reservations_one_way_return_select on public.reservations
  for select to authenticated
  using (
    is_super_admin()
    or (
      is_agency_member(agency_id)
      and return_branch_id is not null
      and private.user_can_access_branch(agency_id, return_branch_id)
    )
  );

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'contract_checkouts',
    'vehicle_preparations',
    'contract_inspections',
    'contract_inspection_photos',
    'contract_signatures',
    'contract_extras',
    'payments',
    'deposits',
    'return_charges',
    'active_rental_updates',
    'rental_extensions',
    'vehicle_swaps'
  ] loop
    execute format($policy$
      create policy %I on public.%I
        for select to authenticated
        using (
          is_super_admin()
          or exists (
            select 1 from public.contracts c
            where c.id = public.%I.contract_id
              and c.agency_id = public.%I.agency_id
              and c.status = 'ACTIVE'
              and c.return_branch_id is not null
              and private.user_can_access_branch(c.agency_id, c.return_branch_id)
          )
        )
    $policy$, table_name || '_one_way_return_select', table_name, table_name, table_name);
  end loop;
exception
  when duplicate_object then null;
end;
$$;

create policy contract_photos_one_way_return_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contract-photos'
    and exists (
      select 1
      from public.contract_inspection_photos p
      join public.contracts c on c.id = p.contract_id and c.agency_id = p.agency_id
      where p.storage_path = storage.objects.name
        and c.status = 'ACTIVE'
        and c.return_branch_id is not null
        and private.user_can_access_branch(c.agency_id, c.return_branch_id)
    )
  );

-- Destination-branch staff upload return photos into the private bucket.  The
-- inspection row is still tenant-scoped and the branch is validated against
-- the active contract's authorized return branch.
create policy contract_photos_one_way_return_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'contract-photos'
    and exists (
      select 1
      from public.contract_inspection_photos p
      join public.contracts c on c.id = p.contract_id and c.agency_id = p.agency_id
      where p.storage_path = storage.objects.name
        and c.status = 'ACTIVE'
        and c.return_branch_id is not null
        and private.user_can_access_branch(c.agency_id, c.return_branch_id)
    )
  );
