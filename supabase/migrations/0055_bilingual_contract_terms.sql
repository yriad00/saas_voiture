alter table public.contracts
  add column if not exists terms_ar text,
  add column if not exists contract_language text not null default 'FR';

alter table public.contracts
  drop constraint if exists contracts_contract_language_check;
alter table public.contracts
  add constraint contracts_contract_language_check check (contract_language in ('FR','AR','BILINGUAL'));
