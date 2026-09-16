alter table public.vehicles
  add column if not exists weekly_rate numeric(14,2) not null default 0,
  add column if not exists monthly_rate numeric(14,2) not null default 0,
  add column if not exists deposit_amount numeric(14,2) not null default 0,
  add column if not exists ownership_type text not null default 'OWNED',
  add column if not exists photo_urls jsonb not null default '[]'::jsonb;

alter table public.vehicles
  drop constraint if exists vehicles_weekly_rate_check,
  drop constraint if exists vehicles_monthly_rate_check,
  drop constraint if exists vehicles_deposit_amount_check,
  drop constraint if exists vehicles_ownership_type_check;
alter table public.vehicles
  add constraint vehicles_weekly_rate_check check (weekly_rate >= 0),
  add constraint vehicles_monthly_rate_check check (monthly_rate >= 0),
  add constraint vehicles_deposit_amount_check check (deposit_amount >= 0),
  add constraint vehicles_ownership_type_check check (ownership_type in ('OWNED','LEASING','SUBLEASE'));

create index if not exists vehicles_agency_ownership_idx on public.vehicles (agency_id, ownership_type) where deleted_at is null;
