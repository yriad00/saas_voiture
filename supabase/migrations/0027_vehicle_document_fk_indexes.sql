create index if not exists vehicle_documents_vehicle_id_idx on public.vehicle_documents (vehicle_id);
create index if not exists vehicle_documents_created_by_idx on public.vehicle_documents (created_by);
