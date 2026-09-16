-- Check-in/return and operational rental follow-up entities.
alter table public.contracts
  add column if not exists return_charges_total numeric(14,2) not null default 0,
  add column if not exists final_total_amount numeric(14,2);

create table if not exists public.contract_checkins (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  reservation_id uuid references public.reservations(id) on delete set null,
  actual_return_at timestamptz not null default now(),
  returned_by uuid references auth.users(id) on delete set null,
  return_mileage integer not null check (return_mileage >= 0),
  fuel_level integer not null check (fuel_level between 0 and 8),
  cleanliness text not null default 'ACCEPTABLE' check (cleanliness in ('CLEAN','ACCEPTABLE','DIRTY')),
  exterior_condition text,
  interior_condition text,
  missing_items jsonb not null default '[]'::jsonb,
  notes text,
  signature_name text,
  signature_data text,
  status text not null default 'DRAFT' check (status in ('DRAFT','REVIEW','FINALIZED')),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id)
);
create index if not exists contract_checkins_agency_branch_idx on public.contract_checkins(agency_id, branch_id, actual_return_at desc);
create index if not exists contract_checkins_contract_idx on public.contract_checkins(contract_id);
create index if not exists contract_checkins_vehicle_idx on public.contract_checkins(vehicle_id, actual_return_at desc);

create table if not exists public.return_charges (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  checkin_id uuid references public.contract_checkins(id) on delete set null,
  charge_type text not null check (charge_type in ('LATE_RETURN','EXTRA_HOURS','EXTRA_DAYS','EXTRA_MILEAGE','FUEL','CLEANING','DAMAGE','MISSING_ITEM','OTHER')),
  quantity numeric(14,3) not null default 1 check (quantity >= 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  amount numeric(14,2) not null check (amount >= 0),
  reason text not null,
  source text not null default 'AUTOMATIC' check (source in ('AUTOMATIC','MANUAL','OVERRIDE')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists return_charges_contract_idx on public.return_charges(agency_id, contract_id, created_at desc);
create index if not exists return_charges_branch_idx on public.return_charges(agency_id, branch_id, created_at desc);

create table if not exists public.return_charge_override_history (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict, charge_id uuid not null references public.return_charges(id) on delete cascade,
  original_amount numeric(14,2) not null, overridden_amount numeric(14,2) not null check (overridden_amount >= 0), reason text not null,
  actor_id uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create index if not exists return_charge_override_charge_idx on public.return_charge_override_history(charge_id, created_at desc);

create table if not exists public.damage_records (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict, vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null, contract_id uuid references public.contracts(id) on delete set null,
  checkout_inspection_id uuid references public.contract_inspections(id) on delete set null,
  checkin_inspection_id uuid references public.contract_inspections(id) on delete set null,
  detected_at timestamptz not null default now(), body_area text not null, damage_type text not null,
  severity text not null default 'MINOR' check (severity in ('MINOR','MODERATE','MAJOR','CRITICAL')),
  description text not null, photos jsonb not null default '[]'::jsonb,
  estimated_repair_cost numeric(14,2) not null default 0 check (estimated_repair_cost >= 0), final_repair_cost numeric(14,2) not null default 0 check (final_repair_cost >= 0),
  customer_charge numeric(14,2) not null default 0 check (customer_charge >= 0), insurance_charge numeric(14,2) not null default 0 check (insurance_charge >= 0),
  status text not null default 'REPORTED' check (status in ('REPORTED','UNDER_REVIEW','APPROVED','REPAIRING','REPAIRED','CLOSED')),
  notes text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists damage_records_vehicle_idx on public.damage_records(agency_id, vehicle_id, detected_at desc);
create index if not exists damage_records_contract_idx on public.damage_records(contract_id);
create index if not exists damage_records_branch_idx on public.damage_records(agency_id, branch_id, detected_at desc);

create table if not exists public.accidents (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict, vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  contract_id uuid references public.contracts(id) on delete set null, customer_id uuid references public.customers(id) on delete set null,
  occurred_at timestamptz not null, location text not null, description text not null, photos jsonb not null default '[]'::jsonb,
  constat_path text, police_reference text, insurance_company text, claim_reference text,
  deductible numeric(14,2) not null default 0 check (deductible >= 0), estimated_repair_cost numeric(14,2) not null default 0 check (estimated_repair_cost >= 0), final_cost numeric(14,2) not null default 0 check (final_cost >= 0), customer_liability numeric(14,2) not null default 0 check (customer_liability >= 0), insurance_reimbursement numeric(14,2) not null default 0 check (insurance_reimbursement >= 0),
  status text not null default 'REPORTED' check (status in ('REPORTED','UNDER_REVIEW','CLAIM_OPEN','REPAIRING','RESOLVED','CLOSED')), notes text,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists accidents_vehicle_idx on public.accidents(agency_id, vehicle_id, occurred_at desc);
create index if not exists accidents_contract_idx on public.accidents(contract_id);

create table if not exists public.fines (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict, vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  violation_at timestamptz not null, reference text, amount numeric(14,2) not null default 0 check (amount >= 0), document_path text,
  status text not null default 'UNRESOLVED' check (status in ('UNRESOLVED','LINKED','DISPUTED','PAID','CANCELLED')),
  contract_id uuid references public.contracts(id) on delete set null, customer_id uuid references public.customers(id) on delete set null, notes text,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists fines_vehicle_time_idx on public.fines(agency_id, vehicle_id, violation_at);
create index if not exists fines_contract_idx on public.fines(contract_id);

create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict, contract_id uuid not null unique references public.contracts(id) on delete cascade,
  required_amount numeric(14,2) not null default 0 check (required_amount >= 0), received_amount numeric(14,2) not null default 0 check (received_amount >= 0), held_amount numeric(14,2) not null default 0 check (held_amount >= 0), deducted_amount numeric(14,2) not null default 0 check (deducted_amount >= 0), refunded_amount numeric(14,2) not null default 0 check (refunded_amount >= 0), status text not null default 'REQUIRED' check (status in ('REQUIRED','RECEIVED','HELD','PARTIALLY_DEDUCTED','REFUNDED','CLOSED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists deposits_branch_idx on public.deposits(agency_id, branch_id, updated_at desc);
create table if not exists public.deposit_transactions (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade, branch_id uuid references public.branches(id) on delete restrict,
  deposit_id uuid not null references public.deposits(id) on delete cascade, transaction_type text not null check (transaction_type in ('RECEIVED','DEDUCTION','REFUND')), amount numeric(14,2) not null check (amount > 0), reason text, damage_id uuid references public.damage_records(id) on delete set null, fine_id uuid references public.fines(id) on delete set null, idempotency_key text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique (agency_id, idempotency_key)
);
create index if not exists deposit_transactions_deposit_idx on public.deposit_transactions(deposit_id, created_at);

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade, branch_id uuid not null references public.branches(id) on delete restrict,
  opened_at timestamptz not null default now(), opened_by uuid references auth.users(id) on delete set null, opening_balance numeric(14,2) not null default 0 check (opening_balance >= 0), expected_closing_balance numeric(14,2), actual_closing_balance numeric(14,2), difference numeric(14,2), closed_at timestamptz, closed_by uuid references auth.users(id) on delete set null, notes text, status text not null default 'OPEN' check (status in ('OPEN','CLOSED')), unique (branch_id, status)
);
create index if not exists cash_sessions_branch_idx on public.cash_sessions(agency_id, branch_id, opened_at desc);
create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade, branch_id uuid not null references public.branches(id) on delete restrict,
  session_id uuid not null references public.cash_sessions(id) on delete cascade, movement_type text not null check (movement_type in ('PAYMENT','REFUND','EXPENSE','ADJUSTMENT')), amount numeric(14,2) not null check (amount > 0), reference_type text, reference_id uuid, reason text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create index if not exists cash_movements_session_idx on public.cash_movements(session_id, created_at);

create table if not exists public.delivery_missions (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade, branch_id uuid references public.branches(id) on delete restrict,
  vehicle_id uuid references public.vehicles(id) on delete set null, customer_id uuid references public.customers(id) on delete set null, reservation_id uuid references public.reservations(id) on delete set null, contract_id uuid references public.contracts(id) on delete set null, mission_type text not null check (mission_type in ('DELIVERY','COLLECTION','AIRPORT_DELIVERY','HOTEL_DELIVERY','CUSTOMER_ADDRESS','GARAGE','OTHER')), assigned_employee uuid references auth.users(id) on delete set null, address text, location text, scheduled_at timestamptz not null, fee numeric(14,2) not null default 0 check (fee >= 0), notes text, status text not null default 'PLANNED' check (status in ('PLANNED','PREPARING','READY','ON_THE_WAY','COMPLETED','CANCELLED')), created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists delivery_missions_branch_time_idx on public.delivery_missions(agency_id, branch_id, scheduled_at);

create table if not exists public.vehicle_transfers (
  id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id) on delete cascade, vehicle_id uuid not null references public.vehicles(id) on delete restrict, from_branch_id uuid not null references public.branches(id) on delete restrict, to_branch_id uuid not null references public.branches(id) on delete restrict, assigned_driver uuid references auth.users(id) on delete set null, planned_departure timestamptz not null, actual_departure timestamptz, arrival_at timestamptz, mileage_departure integer check (mileage_departure >= 0), mileage_arrival integer check (mileage_arrival >= 0), fuel_departure integer check (fuel_departure between 0 and 8), fuel_arrival integer check (fuel_arrival between 0 and 8), cost numeric(14,2) not null default 0 check (cost >= 0), status text not null default 'PLANNED' check (status in ('PLANNED','IN_TRANSIT','COMPLETED','CANCELLED')), notes text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (from_branch_id <> to_branch_id), check (mileage_arrival is null or mileage_departure is null or mileage_arrival >= mileage_departure)
);
create index if not exists vehicle_transfers_vehicle_idx on public.vehicle_transfers(agency_id, vehicle_id, planned_departure desc);
create index if not exists vehicle_transfers_branch_idx on public.vehicle_transfers(agency_id, from_branch_id, to_branch_id, planned_departure desc);

-- Tenant/branch scope checks for the most sensitive cross-entity writes.
create or replace function private.validate_return_operation_scope() returns trigger language plpgsql security definer set search_path = public, private as $$
declare c_agency uuid; c_vehicle uuid; c_reservation uuid;
begin
  if tg_table_name = 'contract_checkins' then
    select agency_id, vehicle_id, reservation_id into c_agency, c_vehicle, c_reservation from public.contracts where id = new.contract_id;
  elsif tg_table_name = 'return_charges' then
    select agency_id, vehicle_id, reservation_id into c_agency, c_vehicle, c_reservation from public.contracts where id = new.contract_id;
  end if;
  if c_agency is null or c_agency <> new.agency_id then raise exception 'return_operation_scope_mismatch' using errcode='23514'; end if;
  return new;
end $$;
drop trigger if exists contract_checkins_scope on public.contract_checkins;
create trigger contract_checkins_scope before insert or update on public.contract_checkins for each row execute function private.validate_return_operation_scope();
drop trigger if exists return_charges_scope on public.return_charges;
create trigger return_charges_scope before insert or update on public.return_charges for each row execute function private.validate_return_operation_scope();

create or replace function private.validate_transfer_scope() returns trigger language plpgsql security definer set search_path = public, private as $$
declare v_agency uuid;
begin select agency_id into v_agency from public.vehicles where id = new.vehicle_id; if v_agency is null or v_agency <> new.agency_id then raise exception 'vehicle_transfer_scope_mismatch' using errcode='23514'; end if; return new; end $$;
drop trigger if exists vehicle_transfers_scope on public.vehicle_transfers;
create trigger vehicle_transfers_scope before insert or update on public.vehicle_transfers for each row execute function private.validate_transfer_scope();

-- Keep aggregate return charges traceable without changing base rental pricing.
create or replace function private.refresh_return_charges_total() returns trigger language plpgsql security definer set search_path = public, private as $$
declare target uuid;
begin target := coalesce(new.contract_id, old.contract_id); update public.contracts set return_charges_total = coalesce((select sum(amount) from public.return_charges where contract_id = target),0) where id = target; return coalesce(new, old); end $$;
drop trigger if exists return_charges_total_refresh on public.return_charges;
create trigger return_charges_total_refresh after insert or update or delete on public.return_charges for each row execute function private.refresh_return_charges_total();

-- Generic RLS helper for each agency/branch-scoped table.
do $$ declare t text; begin
  foreach t in array array['contract_checkins','return_charges','return_charge_override_history','damage_records','accidents','fines','deposits','deposit_transactions','cash_sessions','cash_movements','delivery_missions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select using (is_super_admin() or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id, branch_id))))', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (is_super_admin() or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id, branch_id))))', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('create policy %I_update on public.%I for update using (is_super_admin() or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id, branch_id)))) with check (is_super_admin() or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id, branch_id))))', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_delete on public.%I for delete using (is_super_admin() or (is_agency_member(agency_id) and (branch_id is null or private.user_can_access_branch(agency_id, branch_id))))', t, t);
  end loop;
end $$;

alter table public.vehicle_transfers enable row level security;
grant select, insert, update, delete on public.vehicle_transfers to authenticated;
drop policy if exists vehicle_transfers_select on public.vehicle_transfers;
create policy vehicle_transfers_select on public.vehicle_transfers for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, from_branch_id) and private.user_can_access_branch(agency_id, to_branch_id)));
drop policy if exists vehicle_transfers_insert on public.vehicle_transfers;
create policy vehicle_transfers_insert on public.vehicle_transfers for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, from_branch_id) and private.user_can_access_branch(agency_id, to_branch_id)));
drop policy if exists vehicle_transfers_update on public.vehicle_transfers;
create policy vehicle_transfers_update on public.vehicle_transfers for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, from_branch_id) and private.user_can_access_branch(agency_id, to_branch_id))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, from_branch_id) and private.user_can_access_branch(agency_id, to_branch_id)));
drop policy if exists vehicle_transfers_delete on public.vehicle_transfers;
create policy vehicle_transfers_delete on public.vehicle_transfers for delete using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, from_branch_id) and private.user_can_access_branch(agency_id, to_branch_id)));
