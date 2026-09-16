-- Retry-safe keys for financial operations.
alter table public.payments
  add column if not exists idempotency_key text;

create unique index if not exists payments_agency_idempotency_unique
  on public.payments (agency_id, idempotency_key)
  where idempotency_key is not null;

-- Issuing the same invoice twice for one contract must be harmless under
-- concurrent requests. Credit notes remain separate records.
create unique index if not exists invoices_agency_contract_issued_unique
  on public.invoices (agency_id, contract_id, kind)
  where status = 'ISSUED' and kind = 'INVOICE' and contract_id is not null;
