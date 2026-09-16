create index if not exists extras_catalog_branch_id_idx on public.extras_catalog (branch_id);
create index if not exists reservation_extras_branch_id_idx on public.reservation_extras (branch_id);
create index if not exists contract_extras_branch_id_idx on public.contract_extras (branch_id);
create index if not exists vehicle_preparations_branch_id_idx on public.vehicle_preparations (branch_id);
