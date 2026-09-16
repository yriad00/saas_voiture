-- The test runner keeps a dedicated service-key client for teardown, so the
-- helper does not need an authenticated grant. Keep it service-role only.
revoke execute on function public.cleanup_test_agency(uuid) from authenticated, anon, public;
grant execute on function public.cleanup_test_agency(uuid) to service_role;
