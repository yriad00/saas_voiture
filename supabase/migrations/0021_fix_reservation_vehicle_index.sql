drop index if exists public.reservations_vehicle_id_idx;
create index if not exists reservations_vehicle_id_idx on public.reservations (vehicle_id);
