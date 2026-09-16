-- Morocco Core blockers: immutable return inspections and bounded cautions.
alter table public.contract_checkins
  add column if not exists finalized_by uuid references auth.users(id);

alter table public.contract_inspections
  add column if not exists status text not null default 'DRAFT',
  add column if not exists finalized_at timestamptz,
  add column if not exists finalized_by uuid references auth.users(id);

do $$
begin
  alter table public.contract_inspections
    add constraint contract_inspections_status_check
    check (status in ('DRAFT', 'FINALIZED'));
exception when duplicate_object then null;
end $$;

create unique index if not exists contract_inspections_contract_type_uidx
  on public.contract_inspections(contract_id, inspection_type);

create index if not exists contract_inspections_agency_contract_idx
  on public.contract_inspections(agency_id, contract_id, inspection_type);

create or replace function private.prevent_finalized_return_inspection_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_op = 'DELETE' and old.inspection_type = 'RETURN' and old.status = 'FINALIZED' then
    raise exception 'finalized_return_inspection_immutable' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.inspection_type = 'RETURN' and old.status = 'FINALIZED' then
    if new.inspection_type is distinct from old.inspection_type
      or new.status is distinct from old.status
      or new.mileage is distinct from old.mileage
      or new.fuel_level is distinct from old.fuel_level
      or new.signature_name is distinct from old.signature_name
      or new.notes is distinct from old.notes
      or new.damage_notes is distinct from old.damage_notes
      or new.inspected_at is distinct from old.inspected_at
      or new.finalized_at is distinct from old.finalized_at
      or new.finalized_by is distinct from old.finalized_by then
      raise exception 'finalized_return_inspection_immutable' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists contract_inspections_finalized_immutable on public.contract_inspections;
create trigger contract_inspections_finalized_immutable
before update or delete on public.contract_inspections
for each row execute function private.prevent_finalized_return_inspection_mutation();

do $$
begin
  alter table public.deposits
    add constraint deposits_received_not_above_required
    check (received_amount <= required_amount);
exception when duplicate_object then null;
end $$;

create or replace function private.apply_deposit_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare d public.deposits%rowtype; available numeric; remaining numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.deposit_id::text, 0));
  select * into d from public.deposits where id = new.deposit_id for update;
  if d.id is null or d.agency_id <> new.agency_id then
    raise exception 'deposit_scope_mismatch' using errcode = '23514';
  end if;
  available := d.held_amount - d.refunded_amount - d.deducted_amount;
  if new.transaction_type = 'RECEIVED' then
    remaining := d.required_amount - d.received_amount;
    if new.amount > remaining then
      raise exception 'deposit_required_amount_exceeded' using errcode = '23514';
    end if;
    update public.deposits set received_amount = received_amount + new.amount,
      held_amount = held_amount + new.amount, status = 'HELD', updated_at = now()
      where id = d.id;
  elsif new.transaction_type = 'DEDUCTION' then
    if new.amount > available then raise exception 'deposit_balance_exceeded' using errcode = '23514'; end if;
    update public.deposits set deducted_amount = deducted_amount + new.amount,
      status = case when deducted_amount + new.amount >= held_amount then 'PARTIALLY_DEDUCTED' else 'PARTIALLY_DEDUCTED' end,
      updated_at = now() where id = d.id;
  else
    if new.amount > available then raise exception 'deposit_balance_exceeded' using errcode = '23514'; end if;
    update public.deposits set refunded_amount = refunded_amount + new.amount,
      status = case when refunded_amount + new.amount >= held_amount - deducted_amount then 'REFUNDED' else 'PARTIALLY_DEDUCTED' end,
      updated_at = now() where id = d.id;
  end if;
  return new;
end $$;
