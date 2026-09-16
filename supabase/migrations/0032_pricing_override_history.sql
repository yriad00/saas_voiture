create table if not exists public.pricing_override_history (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  reservation_id uuid references public.reservations(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  original_daily_rate numeric(14,2) not null check (original_daily_rate >= 0),
  requested_daily_rate numeric(14,2) not null check (requested_daily_rate >= 0),
  minimum_daily_rate numeric(14,2) not null check (minimum_daily_rate >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  reason text not null check (char_length(reason) between 5 and 1000),
  approved boolean not null default true,
  created_at timestamptz not null default now(),
  constraint pricing_override_parent_check check (reservation_id is not null or contract_id is not null)
);

create index if not exists pricing_override_history_agency_idx on public.pricing_override_history (agency_id, created_at desc);
create index if not exists pricing_override_history_branch_idx on public.pricing_override_history (branch_id, created_at desc);
create index if not exists pricing_override_history_reservation_idx on public.pricing_override_history (reservation_id);
create index if not exists pricing_override_history_contract_idx on public.pricing_override_history (contract_id);
create index if not exists pricing_override_history_actor_idx on public.pricing_override_history (actor_id);

alter table public.pricing_override_history enable row level security;
grant select, insert on public.pricing_override_history to authenticated;
drop policy if exists pricing_override_history_select on public.pricing_override_history;
create policy pricing_override_history_select on public.pricing_override_history for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists pricing_override_history_insert on public.pricing_override_history;
create policy pricing_override_history_insert on public.pricing_override_history for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id) and actor_id = auth.uid()));
