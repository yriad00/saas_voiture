insert into storage.buckets (id, name, public)
values ('contract-photos', 'contract-photos', false)
on conflict (id) do update set public = false;

create table if not exists public.contract_inspection_photos (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  inspection_type text not null check (inspection_type in ('PICKUP', 'RETURN')),
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists contract_inspection_photos_agency_contract_idx
  on public.contract_inspection_photos (agency_id, contract_id, inspection_type, created_at desc);

alter table public.contract_inspection_photos enable row level security;

drop policy if exists contract_inspection_photos_select on public.contract_inspection_photos;
create policy contract_inspection_photos_select on public.contract_inspection_photos
  for select using (is_super_admin() or is_agency_member(agency_id));

drop policy if exists contract_inspection_photos_insert on public.contract_inspection_photos;
create policy contract_inspection_photos_insert on public.contract_inspection_photos
  for insert with check (is_super_admin() or is_agency_member(agency_id));

drop policy if exists contract_photos_storage_select on storage.objects;
create policy contract_photos_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contract-photos'
    and is_agency_member(case when name ~ '^[0-9a-fA-F-]{36}/' then split_part(name, '/', 1)::uuid else null end)
  );

drop policy if exists contract_photos_storage_insert on storage.objects;
create policy contract_photos_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'contract-photos'
    and is_agency_member(case when name ~ '^[0-9a-fA-F-]{36}/' then split_part(name, '/', 1)::uuid else null end)
  );
