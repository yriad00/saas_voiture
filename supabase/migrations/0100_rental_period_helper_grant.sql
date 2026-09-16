-- Exclusion constraints evaluate the immutable period helper as the inserting
-- role. Keep its execution permission explicit for authenticated clients and
-- the service-role-only fixture runner; the function cannot mutate state.
grant execute on function private.rental_period(date, date, timestamptz, timestamptz) to authenticated, service_role;
