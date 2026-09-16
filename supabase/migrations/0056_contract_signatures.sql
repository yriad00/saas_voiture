create table if not exists public.contract_signatures (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  signer_type text not null check (signer_type in ('CUSTOMER','EMPLOYEE')),
  signer_id uuid references auth.users(id) on delete set null,
  signer_name text not null check (char_length(signer_name) between 2 and 160),
  signature_data text not null check (char_length(signature_data) between 100 and 3000000),
  signed_at timestamptz not null default now(),
  contract_version integer not null default 1 check (contract_version > 0),
  created_at timestamptz not null default now(),
  unique (contract_id, signer_type, contract_version)
);

create index if not exists contract_signatures_contract_idx on public.contract_signatures (agency_id, contract_id, signed_at desc);
create index if not exists contract_signatures_signer_idx on public.contract_signatures (agency_id, signer_id);

create or replace function private.validate_contract_signature_scope()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare c_agency uuid; c_branch uuid;
begin
  select agency_id, branch_id into c_agency, c_branch from public.contracts where id = new.contract_id;
  if c_agency is null or c_agency <> new.agency_id or c_branch is distinct from new.branch_id then
    raise exception 'contract_signature_scope_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists contract_signatures_scope on public.contract_signatures;
create trigger contract_signatures_scope before insert or update on public.contract_signatures for each row execute function private.validate_contract_signature_scope();

alter table public.contract_signatures enable row level security;
grant select, insert, update on public.contract_signatures to authenticated;
drop policy if exists contract_signatures_select on public.contract_signatures;
create policy contract_signatures_select on public.contract_signatures for select using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists contract_signatures_insert on public.contract_signatures;
create policy contract_signatures_insert on public.contract_signatures for insert with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
drop policy if exists contract_signatures_update on public.contract_signatures;
create policy contract_signatures_update on public.contract_signatures for update using (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id))) with check (is_super_admin() or (is_agency_member(agency_id) and private.user_can_access_branch(agency_id, branch_id)));
