create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  document_type text not null check (document_type in ('REGISTRATION', 'INSURANCE', 'TECHNICAL_INSPECTION', 'LEASE', 'PURCHASE', 'OTHER')),
  document_number text,
  issued_at date,
  expires_at date,
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicle_documents_vehicle_created_idx
  on public.vehicle_documents (agency_id, vehicle_id, created_at desc);
create index if not exists vehicle_documents_expiry_idx
  on public.vehicle_documents (agency_id, expires_at)
  where expires_at is not null;

alter table public.vehicle_documents enable row level security;
grant select, insert, update, delete on public.vehicle_documents to authenticated;

drop policy if exists vehicle_documents_select on public.vehicle_documents;
create policy vehicle_documents_select on public.vehicle_documents
  for select using (is_super_admin() or (is_agency_member(agency_id) and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and private.user_can_access_branch(v.agency_id, v.branch_id)
  )));
drop policy if exists vehicle_documents_insert on public.vehicle_documents;
create policy vehicle_documents_insert on public.vehicle_documents
  for insert with check (is_super_admin() or (is_agency_member(agency_id) and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and v.agency_id = agency_id and private.user_can_access_branch(v.agency_id, v.branch_id)
  )));
drop policy if exists vehicle_documents_update on public.vehicle_documents;
create policy vehicle_documents_update on public.vehicle_documents
  for update using (is_super_admin() or (is_agency_member(agency_id) and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and private.user_can_access_branch(v.agency_id, v.branch_id)
  ))) with check (is_super_admin() or (is_agency_member(agency_id) and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and v.agency_id = agency_id and private.user_can_access_branch(v.agency_id, v.branch_id)
  )));
drop policy if exists vehicle_documents_delete on public.vehicle_documents;
create policy vehicle_documents_delete on public.vehicle_documents
  for delete using (is_super_admin() or (is_agency_member(agency_id) and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and private.user_can_access_branch(v.agency_id, v.branch_id)
  )));

insert into storage.buckets (id, name, public)
values ('vehicle-documents', 'vehicle-documents', false)
on conflict (id) do update set public = false;

drop policy if exists vehicle_documents_storage_select on storage.objects;
create policy vehicle_documents_storage_select on storage.objects
  for select to authenticated using (
    bucket_id = 'vehicle-documents'
    and exists (
      select 1 from public.vehicle_documents d
      where d.storage_path = name
        and private.user_can_access_branch(d.agency_id, (select v.branch_id from public.vehicles v where v.id = d.vehicle_id))
    )
  );
drop policy if exists vehicle_documents_storage_insert on storage.objects;
create policy vehicle_documents_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'vehicle-documents'
    and exists (
      select 1 from public.vehicles v
      where v.id = case when name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/' then split_part(name, '/', 2)::uuid else null end
        and private.user_can_access_branch(v.agency_id, v.branch_id)
    )
  );
drop policy if exists vehicle_documents_storage_delete on storage.objects;
create policy vehicle_documents_storage_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'vehicle-documents'
    and exists (
      select 1 from public.vehicle_documents d
      where d.storage_path = name
        and private.user_can_access_branch(d.agency_id, (select v.branch_id from public.vehicles v where v.id = d.vehicle_id))
    )
  );
