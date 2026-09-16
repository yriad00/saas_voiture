-- Keep direct Storage uploads aligned with the server action permission boundary.
drop policy if exists customer_documents_storage_insert on storage.objects;
create policy customer_documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'customer-documents'
    and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
    and is_agency_member(split_part(name, '/', 1)::uuid)
    and user_has_permission(split_part(name, '/', 1)::uuid, 'customers.update')
  );

drop policy if exists customer_documents_storage_delete on storage.objects;
create policy customer_documents_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'customer-documents'
    and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
    and is_agency_member(split_part(name, '/', 1)::uuid)
    and user_has_permission(split_part(name, '/', 1)::uuid, 'customers.update')
  );
