# Database migrations

The tracked release migrations run from `0001` through the current recovery
pass (`0098`). They include branches, availability, pricing, extras, return
operations, Morocco Core financial integrity, atomic check-in/closure and
reservation outcomes, private accident media, idempotent sub-rental owner
settlements, and a service-role-only synthetic fixture teardown helper.

Before applying them to production:

1. Export the current schema, RLS policies, grants, functions, indexes and
   triggers from the Supabase project and commit the baseline migration.
2. Check for duplicate reservation/contract references, duplicate issued
   invoices per contract, invalid date ranges, and overlapping active rentals
   in staging.
3. Apply migrations 0001 through the current migration to a clean staging database and run
   tenant-isolation, extras-total and concurrent-booking tests.
4. Verify private `contract-photos`, `customer-documents`, `vehicle-documents`,
   `damage-photos` and `accident-photos` storage access with signed URLs and
   reject cross-agency paths.
5. Apply them to production only after a tested backup and rollback procedure.

Invoice issuance currently treats the contract total as HT and applies the
agency setting's TVA rate. Confirm that accounting convention with the agency
before enabling invoice issuance in production.
