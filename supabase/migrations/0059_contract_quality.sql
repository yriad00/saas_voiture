-- Morocco Core quality hardening: immutable signature records, terms snapshot metadata,
-- and the remaining foreign-key indexes reported by the Supabase advisor.
alter table public.contracts
  add column if not exists terms_version integer not null default 1,
  add column if not exists terms_snapshot_at timestamptz not null default now();

alter table public.contracts
  drop constraint if exists contracts_terms_version_check;
alter table public.contracts
  add constraint contracts_terms_version_check check (terms_version > 0);

create index if not exists contract_signatures_branch_fk_idx
  on public.contract_signatures (branch_id);
create index if not exists contract_signatures_signer_fk_idx
  on public.contract_signatures (signer_id);

-- A signature is an append-only legal/history record. No client-facing flow needs
-- to update or delete it; a new signature creates a new contract version.
drop policy if exists contract_signatures_update on public.contract_signatures;
drop policy if exists contract_signatures_delete on public.contract_signatures;
revoke update, delete on public.contract_signatures from authenticated;

-- These indexes duplicate the single-column indexes created in 0048.
drop index if exists public.accident_damages_accident_fk_idx;
drop index if exists public.accident_damages_damage_fk_idx;
drop index if exists public.accidents_contract_fk_idx;
drop index if exists public.fines_contract_fk_idx;
