create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,15}$'),
  city text,
  address text,
  phone text,
  whatsapp text,
  email text,
  opening_hours jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, code)
);

create index if not exists branches_agency_active_idx on public.branches (agency_id, active, name);
alter table public.branches enable row level security;
grant select, insert, update on public.branches to authenticated;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.user_can_access_branch(p_agency_id uuid, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agency_members m
    where m.agency_id = p_agency_id
      and m.profile_id = (select auth.uid())
      and m.status = 'active'
      and (m.branch_id is null or m.branch_id = p_branch_id)
  );
$$;
revoke all on function private.user_can_access_branch(uuid, uuid) from public;
grant execute on function private.user_can_access_branch(uuid, uuid) to authenticated;

drop policy if exists branches_select on public.branches;
create policy branches_select on public.branches
  for select to authenticated
  using (is_super_admin() or private.user_can_access_branch(agency_id, id));

drop policy if exists branches_insert on public.branches;
create policy branches_insert on public.branches
  for insert to authenticated
  with check (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'branches.create')));

drop policy if exists branches_update on public.branches;
create policy branches_update on public.branches
  for update to authenticated
  using (is_super_admin() or (private.user_can_access_branch(agency_id, id) and user_has_permission(agency_id, 'branches.update')))
  with check (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'branches.update')));

alter table public.vehicles add column if not exists branch_id uuid;
alter table public.reservations add column if not exists branch_id uuid;
alter table public.contracts add column if not exists branch_id uuid;
alter table public.payments add column if not exists branch_id uuid;
alter table public.expenses add column if not exists branch_id uuid;
alter table public.invoices add column if not exists branch_id uuid;
alter table public.maintenance_records add column if not exists branch_id uuid;
alter table public.contract_inspections add column if not exists branch_id uuid;
alter table public.contract_inspection_photos add column if not exists branch_id uuid;
alter table public.audit_logs add column if not exists branch_id uuid;

do $$
declare
  agency_row record;
  main_branch uuid;
begin
  for agency_row in select id, name, city, address, phone, email from public.agencies loop
    insert into public.branches (agency_id, name, code, city, address, phone, email)
    values (agency_row.id, coalesce(nullif(trim(agency_row.name), ''), 'Agence') || ' — Principal', 'MAIN', agency_row.city, agency_row.address, agency_row.phone, agency_row.email)
    on conflict (agency_id, code) do nothing;
    select id into main_branch from public.branches where agency_id = agency_row.id and code = 'MAIN';
    update public.vehicles set branch_id = main_branch where agency_id = agency_row.id and branch_id is null;
    update public.reservations set branch_id = main_branch where agency_id = agency_row.id and branch_id is null;
    update public.contracts set branch_id = main_branch where agency_id = agency_row.id and branch_id is null;
    update public.payments set branch_id = main_branch where agency_id = agency_row.id and branch_id is null;
    update public.expenses set branch_id = main_branch where agency_id = agency_row.id and branch_id is null;
    update public.invoices set branch_id = main_branch where agency_id = agency_row.id and branch_id is null;
    update public.maintenance_records set branch_id = main_branch where agency_id = agency_row.id and branch_id is null;
    update public.contract_inspections set branch_id = main_branch where agency_id = agency_row.id and branch_id is null;
    update public.contract_inspection_photos set branch_id = main_branch where agency_id = agency_row.id and branch_id is null;
    update public.audit_logs set branch_id = main_branch where agency_id = agency_row.id and branch_id is null;
    update public.agency_members m
      set branch_id = main_branch
      from public.roles r
      where m.role_id = r.id and m.agency_id = agency_row.id and m.branch_id is null and r.key <> 'AGENCY_OWNER';
  end loop;
end;
$$;

do $$
begin
  alter table public.agency_members add constraint agency_members_branch_fk foreign key (branch_id) references public.branches(id) on delete restrict;
exception when duplicate_object then null;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['vehicles','reservations','contracts','payments','expenses','invoices','maintenance_records','contract_inspections','contract_inspection_photos','audit_logs'] loop
    begin
      execute format('alter table public.%I add constraint %I foreign key (branch_id) references public.branches(id) on delete restrict', table_name, table_name || '_branch_fk');
    exception when duplicate_object then null;
    end;
  end loop;
end;
$$;

create index if not exists agency_members_agency_branch_idx on public.agency_members (agency_id, branch_id);
create index if not exists vehicles_agency_branch_idx on public.vehicles (agency_id, branch_id);
create index if not exists reservations_agency_branch_dates_idx on public.reservations (agency_id, branch_id, start_date, end_date);
create index if not exists contracts_agency_branch_dates_idx on public.contracts (agency_id, branch_id, start_date, end_date);
create index if not exists payments_agency_branch_paid_idx on public.payments (agency_id, branch_id, paid_at desc);
create index if not exists expenses_agency_branch_date_idx on public.expenses (agency_id, branch_id, expense_date desc);
create index if not exists invoices_agency_branch_issued_idx on public.invoices (agency_id, branch_id, issued_at desc);
create index if not exists maintenance_agency_branch_date_idx on public.maintenance_records (agency_id, branch_id, service_date desc);
create index if not exists audit_logs_agency_branch_created_idx on public.audit_logs (agency_id, branch_id, created_at desc);

drop policy if exists members_select on public.agency_members;
create policy members_select on public.agency_members
  for select using (is_super_admin() or (agency_id in (select get_user_agency_ids()) and (branch_id is null or private.user_can_access_branch(agency_id, branch_id))));

drop policy if exists members_insert on public.agency_members;
create policy members_insert on public.agency_members
  for insert with check (is_super_admin() or (user_has_permission(agency_id, 'users.create') and (branch_id is null or private.user_can_access_branch(agency_id, branch_id))));

drop policy if exists members_update on public.agency_members;
create policy members_update on public.agency_members
  for update
  using (is_super_admin() or user_has_permission(agency_id, 'users.update'))
  with check (is_super_admin() or (user_has_permission(agency_id, 'users.update') and (branch_id is null or private.user_can_access_branch(agency_id, branch_id))));

drop policy if exists agency_member_select on public.vehicles;
create policy agency_member_select on public.vehicles for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists agency_member_insert on public.vehicles;
create policy agency_member_insert on public.vehicles for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'fleet:write')));
drop policy if exists agency_member_update on public.vehicles;
create policy agency_member_update on public.vehicles for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'fleet:write'))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'fleet:write')));
drop policy if exists agency_member_delete on public.vehicles;
create policy agency_member_delete on public.vehicles for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'fleet:write')));

drop policy if exists member_select on public.reservations;
create policy member_select on public.reservations for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists member_insert on public.reservations;
create policy member_insert on public.reservations for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'reservations:write')));
drop policy if exists member_update on public.reservations;
create policy member_update on public.reservations for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'reservations:write'))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'reservations:write')));
drop policy if exists member_delete on public.reservations;
create policy member_delete on public.reservations for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'reservations:write')));

drop policy if exists member_select on public.contracts;
create policy member_select on public.contracts for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists member_insert on public.contracts;
create policy member_insert on public.contracts for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'contracts:write')));
drop policy if exists member_update on public.contracts;
create policy member_update on public.contracts for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'contracts:write'))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'contracts:write')));
drop policy if exists member_delete on public.contracts;
create policy member_delete on public.contracts for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'contracts:write')));

drop policy if exists member_select on public.payments;
create policy member_select on public.payments for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists member_insert on public.payments;
create policy member_insert on public.payments for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'payments:write')));
drop policy if exists member_update on public.payments;
create policy member_update on public.payments for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'payments:write'))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'payments:write')));
drop policy if exists member_delete on public.payments;
create policy member_delete on public.payments for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'payments:write')));

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'expenses.create')));

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'invoices.create')));
