-- Snapshot return-charge rules on each contract and make the return workflow
-- recoverable after an interrupted finalization. Existing contracts keep an
-- explicit UNSPECIFIED mileage policy so the application never invents an
-- allowance for historical rentals.

alter table public.agency_settings
  add column if not exists mileage_allowance integer,
  add column if not exists extra_mileage_rate numeric(14,2) not null default 2,
  add column if not exists fuel_shortfall_rate numeric(14,2) not null default 100,
  add column if not exists cleaning_fee numeric(14,2) not null default 200;

alter table public.agency_settings
  drop constraint if exists agency_settings_mileage_allowance_check,
  drop constraint if exists agency_settings_extra_mileage_rate_check,
  drop constraint if exists agency_settings_fuel_shortfall_rate_check,
  drop constraint if exists agency_settings_cleaning_fee_check;

alter table public.agency_settings
  add constraint agency_settings_mileage_allowance_check check (mileage_allowance is null or mileage_allowance >= 0),
  add constraint agency_settings_extra_mileage_rate_check check (extra_mileage_rate >= 0),
  add constraint agency_settings_fuel_shortfall_rate_check check (fuel_shortfall_rate >= 0),
  add constraint agency_settings_cleaning_fee_check check (cleaning_fee >= 0);

alter table public.contracts
  add column if not exists mileage_policy text not null default 'UNSPECIFIED',
  add column if not exists mileage_allowance integer,
  add column if not exists extra_mileage_rate numeric(14,2),
  add column if not exists fuel_shortfall_rate numeric(14,2),
  add column if not exists cleaning_fee numeric(14,2),
  add column if not exists early_return_adjustment numeric(14,2) not null default 0;

alter table public.contracts
  drop constraint if exists contracts_mileage_policy_check,
  drop constraint if exists contracts_mileage_allowance_check,
  drop constraint if exists contracts_extra_mileage_rate_check,
  drop constraint if exists contracts_fuel_shortfall_rate_check,
  drop constraint if exists contracts_cleaning_fee_check;
  
alter table public.contracts
  drop constraint if exists contracts_early_return_adjustment_check;

alter table public.contracts
  add constraint contracts_mileage_policy_check check (mileage_policy in ('UNLIMITED','LIMITED','UNSPECIFIED')),
  add constraint contracts_mileage_allowance_check check (mileage_allowance is null or mileage_allowance >= 0),
  add constraint contracts_extra_mileage_rate_check check (extra_mileage_rate is null or extra_mileage_rate >= 0),
  add constraint contracts_fuel_shortfall_rate_check check (fuel_shortfall_rate is null or fuel_shortfall_rate >= 0),
  add constraint contracts_cleaning_fee_check check (cleaning_fee is null or cleaning_fee >= 0),
  add constraint contracts_early_return_adjustment_check check (early_return_adjustment <= 0);

create index if not exists contracts_return_branch_status_idx
  on public.contracts (agency_id, return_branch_id, status, end_date);

-- The application keeps this table private to the agency/branch, but grants
-- are explicit so the columns remain available through the normal Data API.
grant select, insert, update on public.agency_settings to authenticated;
grant select, insert, update on public.contracts to authenticated;
