alter table public.customers
  add column if not exists whatsapp text,
  add column if not exists id_expiry date,
  add column if not exists driver_license_issued_at date,
  add column if not exists passport_expiry date,
  add column if not exists international_permit_number text,
  add column if not exists customer_type text not null default 'INDIVIDUAL',
  add column if not exists company_name text,
  add column if not exists ice text,
  add column if not exists if_number text,
  add column if not exists rc_number text,
  add column if not exists contact_person text;

alter table public.customers
  drop constraint if exists customers_customer_type_check;
alter table public.customers
  add constraint customers_customer_type_check
  check (customer_type in ('INDIVIDUAL','COMPANY'));

create index if not exists customers_agency_whatsapp_idx on public.customers (agency_id, whatsapp) where deleted_at is null;
create index if not exists customers_agency_ice_idx on public.customers (agency_id, ice) where deleted_at is null;
