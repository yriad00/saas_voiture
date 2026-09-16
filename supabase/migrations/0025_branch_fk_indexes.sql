-- Postgres FK checks and branch reassignment use the branch key directly.
-- Keep single-column indexes so Supabase's FK advisor can verify every constraint.
create index if not exists agency_members_branch_id_idx on public.agency_members (branch_id);
create index if not exists audit_logs_branch_id_idx on public.audit_logs (branch_id);
create index if not exists contract_inspection_photos_branch_id_idx on public.contract_inspection_photos (branch_id);
create index if not exists contract_inspections_branch_id_idx on public.contract_inspections (branch_id);
create index if not exists contracts_branch_id_idx on public.contracts (branch_id);
create index if not exists expenses_branch_id_idx on public.expenses (branch_id);
create index if not exists invoices_branch_id_idx on public.invoices (branch_id);
create index if not exists maintenance_records_branch_id_idx on public.maintenance_records (branch_id);
create index if not exists payments_branch_id_idx on public.payments (branch_id);
create index if not exists reservations_branch_id_idx on public.reservations (branch_id);
create index if not exists vehicles_branch_id_idx on public.vehicles (branch_id);
