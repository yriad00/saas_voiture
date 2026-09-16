-- Supabase's default privileges grant API roles on newly created public tables.
-- These two child entities are private to authenticated agency members; RLS
-- already enforces tenant, branch, and write-permission checks.
revoke all on table public.rental_participants from public, anon;
revoke all on table public.vehicle_owner_settlements from public, anon;
grant select, insert, update, delete on table public.rental_participants to authenticated;
grant select, insert, update, delete on table public.vehicle_owner_settlements to authenticated;
