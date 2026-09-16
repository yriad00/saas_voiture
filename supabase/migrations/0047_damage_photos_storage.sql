insert into storage.buckets(id,name,public) values ('damage-photos','damage-photos',false) on conflict (id) do update set public=false;
create table if not exists public.damage_photos (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict, damage_id uuid not null references public.damage_records(id) on delete cascade,
  storage_path text not null unique, file_name text not null, content_type text not null, size_bytes bigint not null check(size_bytes > 0 and size_bytes <= 10485760), created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create index if not exists damage_photos_damage_idx on public.damage_photos(agency_id, damage_id, created_at desc);
alter table public.damage_photos enable row level security;
grant select, insert, update, delete on public.damage_photos to authenticated;
drop policy if exists damage_photos_select on public.damage_photos;
create policy damage_photos_select on public.damage_photos for select using(is_super_admin() or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id,branch_id))));
drop policy if exists damage_photos_insert on public.damage_photos;
create policy damage_photos_insert on public.damage_photos for insert with check(is_super_admin() or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id,branch_id))));
drop policy if exists damage_photos_delete on public.damage_photos;
create policy damage_photos_delete on public.damage_photos for delete using(is_super_admin() or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id,branch_id))));
drop policy if exists damage_photos_storage_select on storage.objects;
create policy damage_photos_storage_select on storage.objects for select to authenticated using(bucket_id='damage-photos' and exists(select 1 from public.damage_photos p where p.storage_path=name and (is_super_admin() or private.user_can_access_branch(p.agency_id,p.branch_id))));
drop policy if exists damage_photos_storage_insert on storage.objects;
create policy damage_photos_storage_insert on storage.objects for insert to authenticated with check(bucket_id='damage-photos' and is_agency_member(case when name ~ '^[0-9a-fA-F-]{36}/' then split_part(name,'/',1)::uuid else null end));
drop policy if exists damage_photos_storage_delete on storage.objects;
create policy damage_photos_storage_delete on storage.objects for delete to authenticated using(bucket_id='damage-photos' and exists(select 1 from public.damage_photos p where p.storage_path=name and private.user_can_access_branch(p.agency_id,p.branch_id)));
