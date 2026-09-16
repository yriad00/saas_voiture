-- GPS configuration per vehicle. The columns are provider-agnostic so a
-- future webhook can update the last known position without changing the UI.
alter table public.vehicles
  add column if not exists gps_enabled boolean not null default false,
  add column if not exists gps_provider text,
  add column if not exists gps_device_id text,
  add column if not exists gps_tracking_url text,
  add column if not exists gps_last_latitude numeric(9, 6),
  add column if not exists gps_last_longitude numeric(9, 6),
  add column if not exists gps_last_seen_at timestamptz;

alter table public.vehicles
  drop constraint if exists vehicles_gps_coordinates_pair;

alter table public.vehicles
  add constraint vehicles_gps_coordinates_pair
  check ((gps_last_latitude is null and gps_last_longitude is null)
    or (gps_last_latitude between -90 and 90 and gps_last_longitude between -180 and 180));

create index if not exists vehicles_gps_enabled_idx
  on public.vehicles (agency_id, gps_enabled)
  where gps_enabled = true and deleted_at is null;
