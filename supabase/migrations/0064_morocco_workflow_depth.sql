-- Morocco-first workflow depth.  This migration extends existing rental records
-- without removing historical data or changing the existing financial model.

alter type public.reservation_status add value if not exists 'NO_SHOW';

alter table public.reservations
  alter column vehicle_id drop not null,
  add column if not exists vehicle_category text,
  add column if not exists pickup_branch_id uuid references public.branches(id) on delete restrict,
  add column if not exists return_branch_id uuid references public.branches(id) on delete restrict,
  add column if not exists one_way_fee numeric(14,2) not null default 0,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_refund_amount numeric(14,2) not null default 0;

alter table public.reservations
  drop constraint if exists reservations_vehicle_or_category_check,
  drop constraint if exists reservations_one_way_fee_check,
  drop constraint if exists reservations_cancellation_refund_check;
alter table public.reservations
  add constraint reservations_vehicle_or_category_check check (vehicle_id is not null or nullif(trim(vehicle_category), '') is not null),
  add constraint reservations_one_way_fee_check check (one_way_fee >= 0),
  add constraint reservations_cancellation_refund_check check (cancellation_refund_amount >= 0);

create index if not exists reservations_agency_category_dates_idx
  on public.reservations (agency_id, vehicle_category, start_date, end_date)
  where vehicle_id is null and status in ('PENDING','CONFIRMED','ONGOING');
create index if not exists reservations_return_branch_idx
  on public.reservations (agency_id, return_branch_id, start_date, end_date);
create index if not exists reservations_pickup_branch_fk_idx on public.reservations (pickup_branch_id);
create index if not exists reservations_return_branch_fk_idx on public.reservations (return_branch_id);

-- Category-only reservations do not have a vehicle to lock or compare yet.
-- Keep the existing database overlap protection for concrete vehicle bookings.
create or replace function private.prevent_vehicle_unavailability_overlap()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  requested_range daterange;
begin
  if TG_TABLE_NAME = 'reservations' then
    if new.vehicle_id is null or new.status not in ('PENDING', 'CONFIRMED', 'ONGOING') then
      return new;
    end if;
    requested_range := daterange(new.start_date, case when new.end_date = new.start_date then new.end_date + 1 else new.end_date end, '[)');
    perform pg_advisory_xact_lock(hashtextextended(new.vehicle_id::text, 0));
    if exists (
      select 1 from public.vehicle_blocks b
      where b.agency_id = new.agency_id
        and b.vehicle_id = new.vehicle_id
        and b.status = 'ACTIVE'
        and daterange(b.start_date, case when b.end_date = b.start_date then b.end_date + 1 else b.end_date end, '[)') && requested_range
    ) then
      raise exception 'vehicle_unavailable_during_block';
    end if;
    return new;
  end if;

  if new.vehicle_id is null then return new; end if;
  requested_range := daterange(new.start_date, case when new.end_date = new.start_date then new.end_date + 1 else new.end_date end, '[)');
  if new.status = 'ACTIVE' then
    perform pg_advisory_xact_lock(hashtextextended(new.vehicle_id::text, 0));
    if exists (
      select 1 from public.reservations r
      where r.agency_id = new.agency_id
        and r.vehicle_id = new.vehicle_id
        and r.status in ('PENDING', 'CONFIRMED', 'ONGOING')
        and daterange(r.start_date, case when r.end_date = r.start_date then r.end_date + 1 else r.end_date end, '[)') && requested_range
    ) then
      raise exception 'vehicle_has_active_reservation';
    end if;
  end if;
  return new;
end;
$$;

alter table public.contracts
  add column if not exists pickup_branch_id uuid references public.branches(id) on delete restrict,
  add column if not exists return_branch_id uuid references public.branches(id) on delete restrict,
  add column if not exists payer_customer_id uuid references public.customers(id) on delete set null,
  add column if not exists principal_driver_customer_id uuid references public.customers(id) on delete set null,
  add column if not exists one_way_fee numeric(14,2) not null default 0,
  add column if not exists early_return_policy text not null default 'MANAGER_DECISION',
  add column if not exists early_return_decision text,
  add column if not exists early_return_decided_by uuid references auth.users(id) on delete set null,
  add column if not exists early_return_decided_at timestamptz;

alter table public.contracts
  drop constraint if exists contracts_one_way_fee_check,
  drop constraint if exists contracts_early_return_policy_check,
  drop constraint if exists contracts_early_return_decision_check;
alter table public.contracts
  add constraint contracts_one_way_fee_check check (one_way_fee >= 0),
  add constraint contracts_early_return_policy_check check (early_return_policy in ('NO_REFUND','RECALCULATE','PARTIAL_REFUND','MANAGER_DECISION')),
  add constraint contracts_early_return_decision_check check (early_return_decision is null or early_return_decision in ('NO_REFUND','RECALCULATE','PARTIAL_REFUND'));

create index if not exists contracts_payer_customer_idx on public.contracts (agency_id, payer_customer_id);
create index if not exists contracts_driver_customer_idx on public.contracts (agency_id, principal_driver_customer_id);
create index if not exists contracts_return_branch_idx on public.contracts (agency_id, return_branch_id, end_date);
create index if not exists contracts_pickup_branch_fk_idx on public.contracts (pickup_branch_id);
create index if not exists contracts_return_branch_fk_idx on public.contracts (return_branch_id);
create index if not exists contracts_payer_customer_fk_idx on public.contracts (payer_customer_id);
create index if not exists contracts_driver_customer_fk_idx on public.contracts (principal_driver_customer_id);

-- Existing contract RLS protects its own agency/branch, but UUID links added
-- here must also be checked against the contract's tenant.
create or replace function private.validate_contract_morocco_scope()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.branch_id is not null and not exists (
    select 1 from public.branches b where b.id = new.branch_id and b.agency_id = new.agency_id
  ) then
    raise exception 'contract_branch_scope_mismatch' using errcode = '23514';
  end if;
  if not exists (select 1 from public.customers c where c.id = new.customer_id and c.agency_id = new.agency_id)
    or not exists (select 1 from public.vehicles v where v.id = new.vehicle_id and v.agency_id = new.agency_id)
    or (new.reservation_id is not null and not exists (select 1 from public.reservations r where r.id = new.reservation_id and r.agency_id = new.agency_id))
  then
    raise exception 'contract_rental_scope_mismatch' using errcode = '23514';
  end if;
  if new.pickup_branch_id is not null and not exists (
    select 1 from public.branches b where b.id = new.pickup_branch_id and b.agency_id = new.agency_id
  ) then
    raise exception 'contract_pickup_branch_scope_mismatch' using errcode = '23514';
  end if;
  if new.return_branch_id is not null and not exists (
    select 1 from public.branches b where b.id = new.return_branch_id and b.agency_id = new.agency_id
  ) then
    raise exception 'contract_return_branch_scope_mismatch' using errcode = '23514';
  end if;
  if new.payer_customer_id is not null and not exists (
    select 1 from public.customers c where c.id = new.payer_customer_id and c.agency_id = new.agency_id
  ) then
    raise exception 'contract_payer_scope_mismatch' using errcode = '23514';
  end if;
  if new.principal_driver_customer_id is not null and not exists (
    select 1 from public.customers c where c.id = new.principal_driver_customer_id and c.agency_id = new.agency_id
  ) then
    raise exception 'contract_driver_scope_mismatch' using errcode = '23514';
  end if;
  if new.pickup_branch_id is not null and new.branch_id is distinct from new.pickup_branch_id then
    raise exception 'contract_pickup_branch_mismatch' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.validate_contract_morocco_scope() from public;
drop trigger if exists contracts_morocco_scope on public.contracts;
create trigger contracts_morocco_scope before insert or update of branch_id, customer_id, vehicle_id, reservation_id, pickup_branch_id, return_branch_id, payer_customer_id, principal_driver_customer_id, agency_id
  on public.contracts for each row execute function private.validate_contract_morocco_scope();

create table if not exists public.rental_participants (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  role text not null check (role in ('PAYER','PRINCIPAL_DRIVER','ADDITIONAL_DRIVER')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (contract_id, role, customer_id)
);
create index if not exists rental_participants_contract_idx on public.rental_participants (agency_id, contract_id, role);
create index if not exists rental_participants_customer_idx on public.rental_participants (agency_id, customer_id);
create index if not exists rental_participants_branch_fk_idx on public.rental_participants (branch_id);
create index if not exists rental_participants_customer_fk_idx on public.rental_participants (customer_id);

-- Scope is always inherited from the contract.  Independent UUID foreign keys
-- are insufficient to prevent a forged cross-agency or cross-branch link.
create or replace function private.validate_rental_participant_scope()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare c_agency uuid; c_branch uuid; p_agency uuid;
begin
  select agency_id, branch_id into c_agency, c_branch from public.contracts where id = new.contract_id;
  select agency_id into p_agency from public.customers where id = new.customer_id;
  if c_agency is null or c_agency <> new.agency_id or p_agency is null or p_agency <> c_agency then
    raise exception 'rental_participant_scope_mismatch' using errcode = '23514';
  end if;
  if new.branch_id is not null and new.branch_id is distinct from c_branch then
    raise exception 'rental_participant_branch_mismatch' using errcode = '23514';
  end if;
  new.branch_id := c_branch;
  return new;
end $$;
revoke all on function private.validate_rental_participant_scope() from public;
drop trigger if exists rental_participants_scope on public.rental_participants;
create trigger rental_participants_scope before insert or update on public.rental_participants
  for each row execute function private.validate_rental_participant_scope();

alter table public.rental_participants enable row level security;
revoke all on public.rental_participants from public, anon;
grant select, insert, update, delete on public.rental_participants to authenticated;
drop policy if exists rental_participants_select on public.rental_participants;
create policy rental_participants_select on public.rental_participants for select to authenticated using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists rental_participants_insert on public.rental_participants;
create policy rental_participants_insert on public.rental_participants for insert to authenticated with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'contracts:write')));
drop policy if exists rental_participants_update on public.rental_participants;
create policy rental_participants_update on public.rental_participants for update to authenticated using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'contracts:write'))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'contracts:write')));
drop policy if exists rental_participants_delete on public.rental_participants;
create policy rental_participants_delete on public.rental_participants for delete to authenticated using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'contracts:write')));

alter table public.vehicles
  add column if not exists owner_name text,
  add column if not exists owner_phone text,
  add column if not exists owner_cost_per_day numeric(14,2) not null default 0,
  add column if not exists owner_cost_type text not null default 'FIXED_DAILY',
  add column if not exists owner_notes text;
alter table public.vehicles
  drop constraint if exists vehicles_owner_cost_check,
  drop constraint if exists vehicles_owner_cost_type_check;
alter table public.vehicles
  add constraint vehicles_owner_cost_check check (owner_cost_per_day >= 0),
  add constraint vehicles_owner_cost_type_check check (owner_cost_type in ('FIXED_DAILY','PERCENT_REVENUE'));

create table if not exists public.vehicle_owner_settlements (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  owner_name text not null,
  owner_contact text,
  rental_revenue numeric(14,2) not null default 0 check (rental_revenue >= 0),
  owner_amount numeric(14,2) not null default 0 check (owner_amount >= 0),
  agency_margin numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  status text not null default 'UNPAID' check (status in ('UNPAID','PARTIALLY_PAID','PAID')),
  paid_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, vehicle_id)
);
create index if not exists vehicle_owner_settlements_owner_idx on public.vehicle_owner_settlements (agency_id, owner_name, status);
create index if not exists vehicle_owner_settlements_contract_idx on public.vehicle_owner_settlements (agency_id, contract_id);
create index if not exists vehicle_owner_settlements_branch_fk_idx on public.vehicle_owner_settlements (branch_id);
create index if not exists vehicle_owner_settlements_vehicle_fk_idx on public.vehicle_owner_settlements (vehicle_id);

create or replace function private.validate_vehicle_owner_settlement_scope()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare c_agency uuid; c_branch uuid; v_agency uuid;
begin
  select agency_id, branch_id into c_agency, c_branch from public.contracts where id = new.contract_id;
  select agency_id into v_agency from public.vehicles where id = new.vehicle_id;
  if c_agency is null or c_agency <> new.agency_id or v_agency is null or v_agency <> c_agency then
    raise exception 'owner_settlement_scope_mismatch' using errcode = '23514';
  end if;
  if new.branch_id is not null and new.branch_id is distinct from c_branch then
    raise exception 'owner_settlement_branch_mismatch' using errcode = '23514';
  end if;
  new.branch_id := c_branch;
  if new.paid_amount > new.owner_amount then
    raise exception 'owner_settlement_overpaid' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.validate_vehicle_owner_settlement_scope() from public;
drop trigger if exists vehicle_owner_settlements_scope on public.vehicle_owner_settlements;
create trigger vehicle_owner_settlements_scope before insert or update on public.vehicle_owner_settlements
  for each row execute function private.validate_vehicle_owner_settlement_scope();
alter table public.vehicle_owner_settlements enable row level security;
revoke all on public.vehicle_owner_settlements from public, anon;
grant select, insert, update, delete on public.vehicle_owner_settlements to authenticated;
drop policy if exists vehicle_owner_settlements_select on public.vehicle_owner_settlements;
create policy vehicle_owner_settlements_select on public.vehicle_owner_settlements for select to authenticated using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists vehicle_owner_settlements_insert on public.vehicle_owner_settlements;
create policy vehicle_owner_settlements_insert on public.vehicle_owner_settlements for insert to authenticated with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'payments:write')));
drop policy if exists vehicle_owner_settlements_update on public.vehicle_owner_settlements;
create policy vehicle_owner_settlements_update on public.vehicle_owner_settlements for update to authenticated using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'payments:write'))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'payments:write')));
drop policy if exists vehicle_owner_settlements_delete on public.vehicle_owner_settlements;
create policy vehicle_owner_settlements_delete on public.vehicle_owner_settlements for delete to authenticated using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and user_has_permission(agency_id, 'payments:write')));

alter table public.damage_records
  add column if not exists garage_name text,
  add column if not exists immobilized_from timestamptz,
  add column if not exists immobilized_to timestamptz,
  add column if not exists repair_invoice_path text,
  add column if not exists repair_notes text;
create index if not exists damage_records_repair_status_idx on public.damage_records (agency_id, status, immobilized_from);

-- Keep payment/expense and cash traceable without duplicating a user's manual entry.
create unique index if not exists cash_movements_reference_unique
  on public.cash_movements (session_id, reference_type, reference_id, movement_type)
  where reference_id is not null;

-- Useful database-level validation for branch fields added to reservations.
create or replace function private.validate_reservation_branch_scope()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.branch_id is not null and not exists (select 1 from public.branches b where b.id = new.branch_id and b.agency_id = new.agency_id) then
    raise exception 'reservation_branch_scope_mismatch' using errcode = '23514';
  end if;
  if not exists (select 1 from public.customers c where c.id = new.customer_id and c.agency_id = new.agency_id)
    or (new.vehicle_id is not null and not exists (select 1 from public.vehicles v where v.id = new.vehicle_id and v.agency_id = new.agency_id))
  then
    raise exception 'reservation_rental_scope_mismatch' using errcode = '23514';
  end if;
  if new.pickup_branch_id is not null and not exists (select 1 from public.branches b where b.id = new.pickup_branch_id and b.agency_id = new.agency_id) then
    raise exception 'reservation_pickup_branch_scope_mismatch' using errcode = '23514';
  end if;
  if new.return_branch_id is not null and not exists (select 1 from public.branches b where b.id = new.return_branch_id and b.agency_id = new.agency_id) then
    raise exception 'reservation_return_branch_scope_mismatch' using errcode = '23514';
  end if;
  if new.pickup_branch_id is not null and new.branch_id is distinct from new.pickup_branch_id then
    raise exception 'reservation_pickup_branch_mismatch' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists reservations_branch_scope on public.reservations;
create trigger reservations_branch_scope before insert or update on public.reservations for each row execute function private.validate_reservation_branch_scope();

alter table public.delivery_missions drop constraint if exists delivery_missions_status_check;
alter table public.delivery_missions add constraint delivery_missions_status_check check (status in ('PLANNED','PREPARING','READY','ACCEPTED','ON_THE_WAY','ARRIVED','COMPLETED','FAILED','CANCELLED'));
