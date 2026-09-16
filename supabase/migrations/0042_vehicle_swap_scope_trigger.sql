create or replace function private.validate_vehicle_swap_scope()
returns trigger language plpgsql security definer set search_path = public, private
as $$
declare c_agency uuid; c_branch uuid; old_agency uuid; old_branch uuid; new_agency uuid; new_branch uuid;
begin
  select agency_id, branch_id into c_agency, c_branch from public.contracts where id = new.contract_id;
  select agency_id, branch_id into old_agency, old_branch from public.vehicles where id = new.old_vehicle_id;
  select agency_id, branch_id into new_agency, new_branch from public.vehicles where id = new.new_vehicle_id;
  if c_agency is null or c_agency <> new.agency_id or c_branch is distinct from new.branch_id or old_agency <> new.agency_id or new_agency <> new.agency_id or old_branch is distinct from new.branch_id or new_branch is distinct from new.branch_id then
    raise exception 'vehicle_swap_scope_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists vehicle_swaps_scope on public.vehicle_swaps;
create trigger vehicle_swaps_scope before insert or update on public.vehicle_swaps for each row execute function private.validate_vehicle_swap_scope();
