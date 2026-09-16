alter table public.invoices drop constraint if exists invoices_kind_check;
alter table public.invoices add constraint invoices_kind_check check (kind in ('INVOICE','CREDIT_NOTE','RECEIPT','QUOTE'));
create index if not exists invoices_agency_kind_issued_idx on public.invoices (agency_id, kind, issued_at desc);
