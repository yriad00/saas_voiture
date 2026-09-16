insert into storage.buckets (id, name, public)
values ('customer-documents', 'customer-documents', false)
on conflict (id) do update set public = false;

create table if not exists public.customer_documents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  document_type text not null check (document_type in ('CIN_RECTO', 'CIN_VERSO', 'DRIVER_LICENSE_RECTO', 'DRIVER_LICENSE_VERSO', 'PASSPORT', 'COMPANY', 'OTHER')),
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists customer_documents_customer_idx
  on public.customer_documents (agency_id, customer_id, created_at desc);

alter table public.customer_documents enable row level security;

drop policy if exists customer_documents_select on public.customer_documents;
create policy customer_documents_select on public.customer_documents
  for select using (is_super_admin() or is_agency_member(agency_id));

drop policy if exists customer_documents_insert on public.customer_documents;
create policy customer_documents_insert on public.customer_documents
  for insert with check (
    is_super_admin()
    or (is_agency_member(agency_id) and user_has_permission(agency_id, 'customers.update') and created_by = auth.uid())
  );

drop policy if exists customer_documents_delete on public.customer_documents;
create policy customer_documents_delete on public.customer_documents
  for delete using (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'customers.update')));

drop policy if exists customer_documents_storage_select on storage.objects;
create policy customer_documents_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'customer-documents'
    and is_agency_member(case when name ~ '^[0-9a-fA-F-]{36}/' then split_part(name, '/', 1)::uuid else null end)
  );

drop policy if exists customer_documents_storage_insert on storage.objects;
create policy customer_documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'customer-documents'
    and is_agency_member(case when name ~ '^[0-9a-fA-F-]{36}/' then split_part(name, '/', 1)::uuid else null end)
  );

drop policy if exists customer_documents_storage_delete on storage.objects;
create policy customer_documents_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'customer-documents'
    and is_agency_member(case when name ~ '^[0-9a-fA-F-]{36}/' then split_part(name, '/', 1)::uuid else null end)
  );
