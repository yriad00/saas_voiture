create table if not exists public.contract_inspections (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  inspection_type text not null check (inspection_type in ('PICKUP', 'RETURN')),
  inspected_at timestamptz not null default now(),
  mileage integer check (mileage is null or mileage >= 0),
  fuel_level integer check (fuel_level is null or fuel_level between 0 and 8),
  signature_name text not null,
  notes text,
  damage_notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (contract_id, inspection_type)
);

create index if not exists contract_inspections_agency_contract_idx
  on public.contract_inspections (agency_id, contract_id, inspected_at desc);

alter table public.contract_inspections enable row level security;

drop policy if exists contract_inspections_select on public.contract_inspections;
create policy contract_inspections_select on public.contract_inspections
  for select using (is_super_admin() or is_agency_member(agency_id));

drop policy if exists contract_inspections_insert on public.contract_inspections;
create policy contract_inspections_insert on public.contract_inspections
  for insert with check (is_super_admin() or is_agency_member(agency_id));

