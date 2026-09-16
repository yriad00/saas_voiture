create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  category text not null check (category in ('FUEL', 'INSURANCE', 'TAX', 'RENT', 'SALARY', 'MARKETING', 'SUPPLIES', 'OTHER')),
  description text,
  vendor text,
  amount numeric(14, 2) not null check (amount > 0),
  expense_date date not null default current_date,
  payment_method public.payment_method not null default 'CASH',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists expenses_agency_date_idx
  on public.expenses (agency_id, expense_date desc);

create index if not exists expenses_vehicle_idx
  on public.expenses (agency_id, vehicle_id, expense_date desc);

alter table public.expenses enable row level security;

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select using (is_super_admin() or is_agency_member(agency_id));

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
  for insert with check (is_super_admin() or is_agency_member(agency_id));
