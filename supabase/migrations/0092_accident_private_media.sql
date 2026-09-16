-- Private media for accidents/claims. The existing accidents.photos JSON is
-- retained for backwards compatibility; new uploads are traceable rows with
-- branch/tenant-aware Storage policies.

insert into storage.buckets (id, name, public)
values ('accident-photos', 'accident-photos', false)
on conflict (id) do update set public = false;

create table if not exists public.accident_photos (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  accident_id uuid not null references public.accidents(id) on delete cascade,
  media_type text not null default 'PHOTO' check (media_type in ('PHOTO', 'CONSTAT', 'OTHER')),
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists accident_photos_accident_idx
  on public.accident_photos(agency_id, accident_id, created_at desc);
create index if not exists accident_photos_branch_idx
  on public.accident_photos(agency_id, branch_id, created_at desc);

alter table public.accident_photos enable row level security;
grant select, insert, update, delete on public.accident_photos to authenticated;

drop policy if exists accident_photos_select on public.accident_photos;
create policy accident_photos_select on public.accident_photos
  for select using (
    is_super_admin()
    or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id, branch_id)))
  );
drop policy if exists accident_photos_insert on public.accident_photos;
create policy accident_photos_insert on public.accident_photos
  for insert with check (
    is_super_admin()
    or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id, branch_id)))
  );
drop policy if exists accident_photos_update on public.accident_photos;
create policy accident_photos_update on public.accident_photos
  for update using (
    is_super_admin()
    or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id, branch_id)))
  ) with check (
    is_super_admin()
    or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id, branch_id)))
  );
drop policy if exists accident_photos_delete on public.accident_photos;
create policy accident_photos_delete on public.accident_photos
  for delete using (
    is_super_admin()
    or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id, branch_id)))
  );

drop policy if exists accident_photos_storage_select on storage.objects;
create policy accident_photos_storage_select on storage.objects
  for select to authenticated using (
    bucket_id = 'accident-photos'
    and exists (
      select 1 from public.accident_photos p
       where p.storage_path = storage.objects.name
         and (is_super_admin() or private.user_can_access_branch(p.agency_id, p.branch_id))
    )
  );

drop policy if exists accident_photos_storage_insert on storage.objects;
create policy accident_photos_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'accident-photos'
    and exists (
      select 1
        from public.accidents a
       where a.id = case
         when name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/' then split_part(name, '/', 2)::uuid
         else null end
         and a.agency_id = case
         when name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/' then split_part(name, '/', 1)::uuid
         else null end
         and (is_super_admin() or private.user_can_access_branch(a.agency_id, a.branch_id))
    )
  );

drop policy if exists accident_photos_storage_delete on storage.objects;
create policy accident_photos_storage_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'accident-photos'
    and exists (
      select 1 from public.accident_photos p
       where p.storage_path = storage.objects.name
         and (is_super_admin() or private.user_can_access_branch(p.agency_id, p.branch_id))
    )
  );

