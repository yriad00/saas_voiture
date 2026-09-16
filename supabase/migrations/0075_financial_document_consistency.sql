-- Keep financial document retries deterministic without rewriting issued history.
-- Existing rows remain valid; NULL keys are backfilled only by new writes.
alter table public.invoices
  add column if not exists document_key text;

create unique index if not exists invoices_agency_document_key_unique
  on public.invoices (agency_id, document_key)
  where document_key is not null and status = 'ISSUED';

alter table public.invoices
  drop constraint if exists invoices_amounts_nonnegative_check;

alter table public.invoices
  add constraint invoices_amounts_nonnegative_check
  check (subtotal >= 0 and tax_rate >= 0 and tax_amount >= 0 and total_amount >= 0);

drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices
  for update using (
    is_super_admin()
    or (
      is_agency_member(agency_id)
      and private.user_can_access_branch(agency_id, branch_id)
      and user_has_permission(agency_id, 'invoices.create')
    )
  )
  with check (
    is_super_admin()
    or (
      is_agency_member(agency_id)
      and private.user_can_access_branch(agency_id, branch_id)
      and user_has_permission(agency_id, 'invoices.create')
    )
  );

create index if not exists invoices_contract_kind_status_idx
  on public.invoices (agency_id, contract_id, kind, status, issued_at desc);
