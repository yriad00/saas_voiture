-- Fix the one-way return Storage insert path without widening tenant access.
-- The 0073 policy looked for an already-created inspection-photo row while
-- Storage is inserting the object first, so destination-branch uploads could
-- never pass for a branch-limited user. Parse the scoped path and authorize
-- against the active contract instead.

drop policy if exists contract_photos_one_way_return_insert on storage.objects;
drop policy if exists contract_photos_storage_insert on storage.objects;

create policy contract_photos_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'contract-photos'
    and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/(PICKUP|RETURN)/'
    and exists (
      select 1
      from public.contracts c
      where c.agency_id = split_part(name, '/', 1)::uuid
        and c.id = split_part(name, '/', 2)::uuid
        and c.status = 'ACTIVE'
        and (
          private.user_can_access_branch(c.agency_id, c.branch_id)
          or (
            split_part(name, '/', 3) = 'RETURN'
            and c.return_branch_id is not null
            and private.user_can_access_branch(c.agency_id, c.return_branch_id)
          )
        )
    )
  );
