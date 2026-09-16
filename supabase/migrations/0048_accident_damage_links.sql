create table if not exists public.accident_damages (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict, accident_id uuid not null references public.accidents(id) on delete cascade,
  damage_id uuid not null references public.damage_records(id) on delete cascade, created_at timestamptz not null default now(), unique(accident_id, damage_id)
);
create index if not exists accident_damages_accident_idx on public.accident_damages(accident_id);
create index if not exists accident_damages_damage_idx on public.accident_damages(damage_id);
alter table public.accident_damages enable row level security;
grant select, insert, update, delete on public.accident_damages to authenticated;
drop policy if exists accident_damages_select on public.accident_damages;
create policy accident_damages_select on public.accident_damages for select using(is_super_admin() or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id,branch_id))));
drop policy if exists accident_damages_insert on public.accident_damages;
create policy accident_damages_insert on public.accident_damages for insert with check(is_super_admin() or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id,branch_id))));
drop policy if exists accident_damages_update on public.accident_damages;
create policy accident_damages_update on public.accident_damages for update using(is_super_admin() or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id,branch_id)))) with check(is_super_admin() or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id,branch_id))));
drop policy if exists accident_damages_delete on public.accident_damages;
create policy accident_damages_delete on public.accident_damages for delete using(is_super_admin() or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id,branch_id))));
