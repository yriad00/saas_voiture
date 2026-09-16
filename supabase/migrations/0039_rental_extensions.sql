create table if not exists public.rental_extensions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  previous_end_date date not null,
  new_end_date date not null,
  added_days integer not null check (added_days >= 1),
  daily_rate numeric(14,2) not null check (daily_rate >= 0),
  extra_amount numeric(14,2) not null check (extra_amount >= 0),
  reason text not null check (char_length(reason) between 2 and 1000),
  status text not null default 'APPROVED' check (status in ('REQUESTED','APPROVED','REJECTED','CANCELLED')),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  constraint rental_extensions_dates check (new_end_date > previous_end_date),
  constraint rental_extensions_days check (added_days = (new_end_date - previous_end_date))
);

create index if not exists rental_extensions_agency_branch_idx on public.rental_extensions (agency_id, branch_id, created_at desc);
create index if not exists rental_extensions_contract_idx on public.rental_extensions (contract_id, created_at desc);
create index if not exists rental_extensions_created_by_idx on public.rental_extensions (created_by);
create index if not exists rental_extensions_approved_by_idx on public.rental_extensions (approved_by);

alter table public.rental_extensions enable row level security;
grant select, insert, update on public.rental_extensions to authenticated;
drop policy if exists rental_extensions_select on public.rental_extensions;
create policy rental_extensions_select on public.rental_extensions for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists rental_extensions_insert on public.rental_extensions;
create policy rental_extensions_insert on public.rental_extensions for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and created_by = auth.uid()));
drop policy if exists rental_extensions_update on public.rental_extensions;
create policy rental_extensions_update on public.rental_extensions for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
