create index if not exists damage_records_vehicle_fk_idx on public.damage_records(vehicle_id);
create index if not exists fines_vehicle_fk_idx on public.fines(vehicle_id);
create index if not exists return_charges_branch_fk_idx on public.return_charges(branch_id);
create index if not exists return_charges_contract_fk_idx on public.return_charges(contract_id);
create index if not exists vehicle_transfers_vehicle_fk_idx on public.vehicle_transfers(vehicle_id);
create index if not exists vehicle_transfers_from_branch_fk_idx on public.vehicle_transfers(from_branch_id);
create index if not exists vehicle_transfers_to_branch_fk_idx on public.vehicle_transfers(to_branch_id);
