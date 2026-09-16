-- Keep expiry information attached to the uploaded document itself so alerts
-- remain accurate when a customer has multiple identity documents.
alter table public.customer_documents
  add column if not exists expires_at date;

create index if not exists customer_documents_expiry_idx
  on public.customer_documents (agency_id, expires_at)
  where expires_at is not null;
