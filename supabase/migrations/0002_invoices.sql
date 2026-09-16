create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  contract_id uuid references public.contracts(id) on delete restrict,
  invoice_number text not null,
  kind text not null default 'INVOICE' check (kind in ('INVOICE', 'CREDIT_NOTE', 'RECEIPT')),
  status text not null default 'ISSUED' check (status in ('DRAFT', 'ISSUED', 'VOID')),
  issued_at timestamptz not null default now(),
  seller_name text not null,
  seller_address text,
  seller_if text,
  seller_tp text,
  seller_ice text,
  buyer_name text not null,
  buyer_address text,
  buyer_ice text,
  currency text not null default 'MAD',
  subtotal numeric(14, 2) not null default 0,
  tax_rate numeric(7, 3) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  payment_method text,
  payment_reference text,
  notes text,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists invoices_agency_number_unique
  on public.invoices (agency_id, invoice_number);

create unique index if not exists invoices_one_issued_per_contract_unique
  on public.invoices (agency_id, contract_id)
  where kind = 'INVOICE' and status = 'ISSUED' and contract_id is not null;

create index if not exists invoices_agency_contract_idx
  on public.invoices (agency_id, contract_id, issued_at desc);

alter table public.invoices enable row level security;

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select using (is_super_admin() or is_agency_member(agency_id));

drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices
  for insert with check (is_super_admin() or is_agency_member(agency_id));
