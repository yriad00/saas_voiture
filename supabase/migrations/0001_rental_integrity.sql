create extension if not exists btree_gist;

alter type public.payment_type add value if not exists 'DEPOSIT_REFUND';

create unique index if not exists reservations_agency_reference_unique
  on public.reservations (agency_id, reference);

create unique index if not exists contracts_agency_number_unique
  on public.contracts (agency_id, contract_number);

alter table public.reservations
  drop constraint if exists reservations_valid_date_range;

alter table public.reservations
  add constraint reservations_valid_date_range
  check (end_date >= start_date);

alter table public.contracts
  drop constraint if exists contracts_valid_date_range;

alter table public.contracts
  add constraint contracts_valid_date_range
  check (end_date >= start_date);

alter table public.reservations
  drop constraint if exists reservations_vehicle_no_overlap;

alter table public.reservations
  add constraint reservations_vehicle_no_overlap
  exclude using gist (
    agency_id with =,
    vehicle_id with =,
    daterange(start_date, case when end_date = start_date then end_date + 1 else end_date end, '[)') with &&
  )
  where (status in ('PENDING', 'CONFIRMED', 'ONGOING'));

alter table public.contracts
  drop constraint if exists contracts_vehicle_no_overlap;

alter table public.contracts
  add constraint contracts_vehicle_no_overlap
  exclude using gist (
    agency_id with =,
    vehicle_id with =,
    daterange(start_date, case when end_date = start_date then end_date + 1 else end_date end, '[)') with &&
  )
  where (status = 'ACTIVE');

create index if not exists reservations_agency_vehicle_dates_idx
  on public.reservations (agency_id, vehicle_id, start_date, end_date)
  where status in ('PENDING', 'CONFIRMED', 'ONGOING');

create index if not exists contracts_agency_vehicle_dates_idx
  on public.contracts (agency_id, vehicle_id, start_date, end_date)
  where status = 'ACTIVE';
