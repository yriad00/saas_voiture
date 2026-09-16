-- Lead pipeline: capture prospects quickly and convert them into reservations.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  first_name text not null,
  last_name text,
  phone text,
  email text,
  requested_category text,
  start_date date,
  end_date date,
  budget numeric(14, 2) check (budget is null or budget >= 0),
  source text not null default 'OTHER' check (source in ('WEBSITE', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'PHONE', 'WALK_IN', 'PARTNER', 'OTHER')),
  notes text,
  follow_up_date date,
  status text not null default 'NEW' check (status in ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST')),
  converted_customer_id uuid references public.customers(id) on delete set null,
  converted_reservation_id uuid references public.reservations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_valid_date_range check (end_date is null or start_date is null or end_date >= start_date)
);

create index if not exists leads_agency_status_followup_idx
  on public.leads (agency_id, status, follow_up_date, created_at desc);

alter table public.leads enable row level security;

drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select using (is_super_admin() or is_agency_member(agency_id));

drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads
  for insert with check (is_super_admin() or is_agency_member(agency_id));

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads
  for update using (is_super_admin() or is_agency_member(agency_id))
  with check (is_super_admin() or is_agency_member(agency_id));

drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads
  for delete using (is_super_admin() or is_agency_member(agency_id));

-- Keep the permission model explicit so the UI and server actions can enforce roles.
insert into public.permissions (key, resource, action, description)
values
  ('leads.view', 'leads', 'view', 'Consulter les prospects'),
  ('leads.create', 'leads', 'create', 'Créer un prospect'),
  ('leads.update', 'leads', 'update', 'Modifier et convertir un prospect'),
  ('leads.delete', 'leads', 'delete', 'Supprimer un prospect')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key in ('AGENCY_OWNER', 'MANAGER', 'AGENT', 'ACCOUNTANT')
  and p.key in ('leads.view', 'leads.create', 'leads.update', 'leads.delete')
on conflict do nothing;

create or replace function public.set_lead_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_lead_updated_at();
