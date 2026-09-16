-- Keep the constraint-backed unique indexes and remove their redundant copies.
drop index if exists public.contracts_agency_number_unique;
drop index if exists public.reservations_agency_reference_unique;
