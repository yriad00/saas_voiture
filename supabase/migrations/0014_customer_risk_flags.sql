-- Agency-private customer risk flags. This is deliberately tenant-scoped and
-- does not create any shared risk network between agencies.
create table if not exists public.customer_risk_flags (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  reason text not null check (reason in ('UNPAID_DEBT', 'FRAUD', 'SERIOUS_DAMAGE', 'REPEATED_FINES', 'LATE_RETURNS', 'DOCUMENT_FRAUD', 'OTHER')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists customer_risk_flags_one_open_idx
  on public.customer_risk_flags (agency_id, customer_id)
  where status = 'OPEN';

create index if not exists customer_risk_flags_customer_idx
  on public.customer_risk_flags (agency_id, customer_id, created_at desc);

alter table public.customer_risk_flags enable row level security;

drop policy if exists customer_risk_flags_select on public.customer_risk_flags;
create policy customer_risk_flags_select on public.customer_risk_flags
  for select using (is_super_admin() or is_agency_member(agency_id));

drop policy if exists customer_risk_flags_insert on public.customer_risk_flags;
create policy customer_risk_flags_insert on public.customer_risk_flags
  for insert with check (
    is_super_admin()
    or (
      is_agency_member(agency_id)
      and user_has_permission(agency_id, 'customers.blacklist.manage')
      and created_by = auth.uid()
    )
  );

drop policy if exists customer_risk_flags_update on public.customer_risk_flags;
create policy customer_risk_flags_update on public.customer_risk_flags
  for update
  using (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'customers.blacklist.manage')))
  with check (is_super_admin() or (is_agency_member(agency_id) and user_has_permission(agency_id, 'customers.blacklist.manage')));

insert into public.permissions (key, resource, action, description)
values ('customers.blacklist.manage', 'customers', 'blacklist.manage', 'Créer et résoudre les signalements de risque client')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key in ('AGENCY_OWNER', 'MANAGER')
  and p.key = 'customers.blacklist.manage'
on conflict do nothing;
