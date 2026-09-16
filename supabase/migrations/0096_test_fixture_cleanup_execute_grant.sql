-- PostgREST service-key requests can execute as the authenticated API role
-- while still carrying a service_role JWT claim. The function itself keeps the
-- strict service-role and synthetic-name checks; this grant only lets the guard
-- run and does not expose teardown to ordinary users.
grant execute on function public.cleanup_test_agency(uuid) to authenticated;
