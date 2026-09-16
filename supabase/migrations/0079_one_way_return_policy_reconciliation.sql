-- The original 0073 policy migration was applied to staging before its
-- migration-history entry was captured.  This non-destructive guard records
-- the reconciliation and fails future deploys if the required policies drift.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contracts' and policyname = 'contracts_one_way_return_select')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicles' and policyname = 'vehicles_one_way_return_select')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reservations' and policyname = 'reservations_one_way_return_select')
     or not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'contract_photos_one_way_return_select')
     or not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'contract_photos_one_way_return_insert') then
    raise exception 'one_way_return_policy_drift_detected';
  end if;
end;
$$;
