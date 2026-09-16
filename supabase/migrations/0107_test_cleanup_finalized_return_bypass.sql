-- Synthetic E2E cleanup may remove finalized inspections after a test run.
-- Keep the application immutability trigger enabled for normal callers and
-- allow the marker-validated service-role cleanup helper to bypass it only for
-- the exact agency being torn down.

create or replace function private.prevent_finalized_return_inspection_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if coalesce(current_setting('fleethub.cleanup_mode', true), '') = 'on'
     and coalesce(current_setting('fleethub.cleanup_agency', true), '') = coalesce(old.agency_id::text, '') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' and old.inspection_type = 'RETURN' and old.status = 'FINALIZED' then
    raise exception 'finalized_return_inspection_immutable' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.inspection_type = 'RETURN' and old.status = 'FINALIZED' then
    if new.inspection_type is distinct from old.inspection_type
      or new.status is distinct from old.status
      or new.mileage is distinct from old.mileage
      or new.fuel_level is distinct from old.fuel_level
      or new.signature_name is distinct from old.signature_name
      or new.notes is distinct from old.notes
      or new.damage_notes is distinct from old.damage_notes
      or new.inspected_at is distinct from old.inspected_at
      or new.finalized_at is distinct from old.finalized_at
      or new.finalized_by is distinct from old.finalized_by then
      raise exception 'finalized_return_inspection_immutable' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

-- Rename the existing marker-validated implementation and put a tiny wrapper
-- in front of it. The wrapper is the only function exposed to the test
-- process, and the setting is transaction-local so it cannot leak to normal
-- requests.
alter function public.cleanup_test_agency(uuid) rename to cleanup_test_agency_impl;

create or replace function public.cleanup_test_agency(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform set_config('fleethub.cleanup_mode', 'on', true);
  perform set_config('fleethub.cleanup_agency', p_agency_id::text, true);
  return public.cleanup_test_agency_impl(p_agency_id);
end;
$$;

revoke all on function public.cleanup_test_agency_impl(uuid) from public, anon, authenticated;
revoke all on function public.cleanup_test_agency(uuid) from public, anon, authenticated;
grant execute on function public.cleanup_test_agency(uuid) to service_role;
