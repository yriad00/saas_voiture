alter table public.reservations
  add column if not exists source text not null default 'OTHER',
  add column if not exists deposit_amount numeric(14,2) not null default 0,
  add column if not exists advance_amount numeric(14,2) not null default 0,
  add column if not exists remaining_amount numeric(14,2) not null default 0;

alter table public.reservations
  drop constraint if exists reservations_source_check,
  drop constraint if exists reservations_deposit_amount_check,
  drop constraint if exists reservations_advance_amount_check,
  drop constraint if exists reservations_remaining_amount_check;
alter table public.reservations
  add constraint reservations_source_check check (source in ('WHATSAPP','PHONE','INSTAGRAM','FACEBOOK','WEBSITE','WALK_IN','PARTNER','OTHER')),
  add constraint reservations_deposit_amount_check check (deposit_amount >= 0),
  add constraint reservations_advance_amount_check check (advance_amount >= 0),
  add constraint reservations_remaining_amount_check check (remaining_amount >= 0);

update public.reservations
set remaining_amount = greatest(0, total_amount - advance_amount)
where remaining_amount = 0 and advance_amount > 0;

create index if not exists reservations_agency_source_idx on public.reservations (agency_id, source);
