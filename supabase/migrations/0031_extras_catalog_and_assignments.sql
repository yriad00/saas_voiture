-- Extras catalog and reservation/contract snapshots.
-- Prices are snapshotted at assignment time so historical contracts remain immutable.

alter table public.reservations
  add column if not exists base_total_amount numeric(14,2),
  add column if not exists extras_total numeric(14,2) not null default 0;
update public.reservations set base_total_amount = total_amount where base_total_amount is null;
alter table public.reservations
  alter column base_total_amount set default 0,
  alter column base_total_amount set not null,
  add constraint reservations_base_total_nonnegative check (base_total_amount >= 0),
  add constraint reservations_extras_total_nonnegative check (extras_total >= 0);

alter table public.contracts
  add column if not exists base_total_amount numeric(14,2),
  add column if not exists extras_total numeric(14,2) not null default 0;
update public.contracts set base_total_amount = total_amount where base_total_amount is null;
alter table public.contracts
  alter column base_total_amount set default 0,
  alter column base_total_amount set not null,
  add constraint contracts_base_total_nonnegative check (base_total_amount >= 0),
  add constraint contracts_extras_total_nonnegative check (extras_total >= 0);

create table if not exists public.extras_catalog (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  code text not null,
  name text not null check (char_length(name) between 2 and 160),
  description text,
  pricing_type text not null check (pricing_type in ('PER_DAY','FLAT','PER_UNIT')),
  price numeric(14,2) not null check (price >= 0),
  min_quantity integer not null default 1 check (min_quantity >= 1),
  max_quantity integer check (max_quantity is null or max_quantity >= min_quantity),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, code)
);

create table if not exists public.reservation_extras (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  extra_id uuid not null references public.extras_catalog(id) on delete restrict,
  code text not null,
  name text not null,
  pricing_type text not null check (pricing_type in ('PER_DAY','FLAT','PER_UNIT')),
  quantity integer not null check (quantity >= 1),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  total_amount numeric(14,2) not null check (total_amount >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (reservation_id, extra_id)
);

create table if not exists public.contract_extras (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  extra_id uuid references public.extras_catalog(id) on delete set null,
  code text not null,
  name text not null,
  pricing_type text not null check (pricing_type in ('PER_DAY','FLAT','PER_UNIT')),
  quantity integer not null check (quantity >= 1),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  total_amount numeric(14,2) not null check (total_amount >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists extras_catalog_agency_branch_idx on public.extras_catalog (agency_id, branch_id, active);
create index if not exists extras_catalog_created_by_idx on public.extras_catalog (created_by);
create index if not exists reservation_extras_agency_branch_idx on public.reservation_extras (agency_id, branch_id);
create index if not exists reservation_extras_reservation_idx on public.reservation_extras (reservation_id);
create index if not exists reservation_extras_extra_idx on public.reservation_extras (extra_id);
create index if not exists reservation_extras_created_by_idx on public.reservation_extras (created_by);
create index if not exists contract_extras_agency_branch_idx on public.contract_extras (agency_id, branch_id);
create index if not exists contract_extras_contract_idx on public.contract_extras (contract_id);
create index if not exists contract_extras_extra_idx on public.contract_extras (extra_id);
create index if not exists contract_extras_created_by_idx on public.contract_extras (created_by);

create or replace function private.validate_extra_assignment()
returns trigger language plpgsql security definer set search_path = public, private
as $$
declare parent_agency uuid; parent_branch uuid; catalog_agency uuid; catalog_branch uuid;
begin
  if tg_table_name = 'reservation_extras' then
    select agency_id, branch_id into parent_agency, parent_branch from public.reservations where id = new.reservation_id;
  else
    select agency_id, branch_id into parent_agency, parent_branch from public.contracts where id = new.contract_id;
  end if;
  select agency_id, branch_id into catalog_agency, catalog_branch from public.extras_catalog where id = new.extra_id;
  if parent_agency is null or catalog_agency is null or parent_agency <> new.agency_id or catalog_agency <> new.agency_id then
    raise exception 'extra_assignment_agency_mismatch' using errcode = '23514';
  end if;
  if parent_branch is distinct from new.branch_id or (catalog_branch is not null and catalog_branch is distinct from new.branch_id) then
    raise exception 'extra_assignment_branch_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.recalculate_reservation_extras()
returns trigger language plpgsql security definer set search_path = public, private
as $$
declare target_id uuid;
begin
  target_id := coalesce(new.reservation_id, old.reservation_id);
  update public.reservations r
    set extras_total = coalesce((select sum(e.total_amount) from public.reservation_extras e where e.reservation_id = target_id), 0),
        total_amount = r.base_total_amount + coalesce((select sum(e.total_amount) from public.reservation_extras e where e.reservation_id = target_id), 0),
        updated_at = now()
  where r.id = target_id;
  return coalesce(new, old);
end;
$$;

create or replace function private.recalculate_contract_extras()
returns trigger language plpgsql security definer set search_path = public, private
as $$
declare target_id uuid;
begin
  target_id := coalesce(new.contract_id, old.contract_id);
  update public.contracts c
    set extras_total = coalesce((select sum(e.total_amount) from public.contract_extras e where e.contract_id = target_id), 0),
        total_amount = c.base_total_amount + coalesce((select sum(e.total_amount) from public.contract_extras e where e.contract_id = target_id), 0),
        updated_at = now()
  where c.id = target_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists reservation_extras_validate on public.reservation_extras;
create trigger reservation_extras_validate before insert or update on public.reservation_extras for each row execute function private.validate_extra_assignment();
drop trigger if exists reservation_extras_totals on public.reservation_extras;
create trigger reservation_extras_totals after insert or update or delete on public.reservation_extras for each row execute function private.recalculate_reservation_extras();
drop trigger if exists contract_extras_validate on public.contract_extras;
create trigger contract_extras_validate before insert or update on public.contract_extras for each row execute function private.validate_extra_assignment();
drop trigger if exists contract_extras_totals on public.contract_extras;
create trigger contract_extras_totals after insert or update or delete on public.contract_extras for each row execute function private.recalculate_contract_extras();

alter table public.extras_catalog enable row level security;
alter table public.reservation_extras enable row level security;
alter table public.contract_extras enable row level security;
grant select, insert, update, delete on public.extras_catalog, public.reservation_extras, public.contract_extras to authenticated;

drop policy if exists extras_catalog_select on public.extras_catalog;
create policy extras_catalog_select on public.extras_catalog for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists extras_catalog_insert on public.extras_catalog;
create policy extras_catalog_insert on public.extras_catalog for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists extras_catalog_update on public.extras_catalog;
create policy extras_catalog_update on public.extras_catalog for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists extras_catalog_delete on public.extras_catalog;
create policy extras_catalog_delete on public.extras_catalog for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));

drop policy if exists reservation_extras_select on public.reservation_extras;
create policy reservation_extras_select on public.reservation_extras for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists reservation_extras_insert on public.reservation_extras;
create policy reservation_extras_insert on public.reservation_extras for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists reservation_extras_update on public.reservation_extras;
create policy reservation_extras_update on public.reservation_extras for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists reservation_extras_delete on public.reservation_extras;
create policy reservation_extras_delete on public.reservation_extras for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));

drop policy if exists contract_extras_select on public.contract_extras;
create policy contract_extras_select on public.contract_extras for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists contract_extras_insert on public.contract_extras;
create policy contract_extras_insert on public.contract_extras for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists contract_extras_update on public.contract_extras;
create policy contract_extras_update on public.contract_extras for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists contract_extras_delete on public.contract_extras;
create policy contract_extras_delete on public.contract_extras for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
