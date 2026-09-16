# FleetHub — Car Rental Management SaaS

Multi-tenant car-rental management platform. A single **Super Admin** provisions and
controls agencies; each agency is fully isolated and manages its own fleet, customers,
reservations, contracts, payments and more. Agencies **cannot** self-register.

Built with **Next.js 16 (App Router)**, **TypeScript (strict)**, **Tailwind v4**, a
hand-rolled shadcn-style UI kit, and **Supabase** (Postgres 17, Auth, RLS).

---

## Build status — phased delivery

The product is delivered in fully-working vertical slices, foundation-first.

| Phase | Scope | Status |
| ----- | ----- | ------ |
| **1** | Scaffold · Auth + role guards · Multi-tenant schema + RLS · Super-Admin agency management (create/activate/deactivate/suspend) · Agency workspace (dashboard/team/settings) | ✅ Done |
| 2 | Branches · Vehicles · Customers · Reservations · Calendar | 🟡 Core workflows and calendar done; branches pending |
| 3 | Pricing · Extras · Promo codes · Contracts (PDF) | 🟡 Contract lifecycle hardening and print view done; pricing engine pending |
| 4 | Check-in / Check-out · Inspections · Photos | 🟡 Remise/restitution evidence and private photos done; advanced damage workflows pending |
| 5 | Payments · Deposits · Invoices · Refunds | 🟡 Payment ledger, deposits/refunds and printable invoice records done; payment matching pending |
| 6 | Maintenance · Expenses · Profitability | 🟡 Maintenance, expenses and profitability view done; category budgets pending |
| 7 | Drivers · Deliveries · Notifications | — |
| 8 | Reports · Audit logs · Global search | 🟡 Audit log shipped; reports/search pending |
| 9 | Client portal · Public booking | — |
| 10 | Plans · Subscriptions · Usage limits · Billing | 🟡 Vehicle/user limits enforced; billing lifecycle pending |
| 11 | AI · WhatsApp · White-label | — |

## Architecture

- **Tenancy**: `profiles.is_super_admin` = platform admin. Agency roles
  (`AGENCY_OWNER`, `MANAGER`, `AGENT`, `ACCOUNTANT`, `DRIVER`, `CLIENT`) live in `roles`;
  `agency_members` links user → agency → role and drives isolation.
- **Security**: RLS on every table, routed through SECURITY DEFINER helpers
  (`is_super_admin()`, `get_user_agency_ids()`, `user_has_permission()`, …). The
  `agency_id` is **never** trusted from the client — it's derived from the session.
- **Auth**: Supabase SSR. Route areas `/super-admin`, `/agency`, `/driver`, `/client`
  are guarded server-side; a suspended/inactive agency loses access (data preserved).

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Environment** — `.env.local` is pre-filled with the Supabase URL and publishable
   key. Add the **service-role key** (Supabase Dashboard → *car_rental_saas* → Settings →
   API → `service_role`):
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
   This is required to create agency owner accounts. It is server-only and gitignored.

3. **Create the first super-admin**
   ```bash
   npm run bootstrap:admin
   ```
   Provide a unique email and a password of at least 12 characters:
   `npm run bootstrap:admin -- email password "Full Name"`.

4. **Run**
   ```bash
   npm run dev
   ```
   Sign in at http://localhost:3000/login.

## Database

The repository now tracks release migrations under `supabase/migrations/`. The
original project snapshot did not include the live schema baseline; export it from
the Supabase project before applying `0001_rental_integrity.sql`, then apply
`0002_invoices.sql`, `0003_contract_inspections.sql`, `0004_audit_logs.sql`, `0005_contract_inspection_photos.sql`, and `0006_expenses.sql` in order. Regenerate types
after schema changes and replace `src/lib/database.types.ts`.
# saas_voiture

## Launch hardening

The rental lifecycle now uses server-side tenant checks, date-overlap checks,
draft contracts before handover, explicit status transitions, separate rental
and deposit totals, invitation-based team onboarding, maintenance status
commands, printable contracts, invoice records and signed handover/return
inspection evidence, a reservation calendar, profitability summary and a
server-side audit trail, and private contract inspection photos stored in
Supabase Storage. MAD values retain centimes and French is the default document
locale.

Before a pilot, export the live Supabase schema and commit the baseline beside
`supabase/migrations/0001_rental_integrity.sql`. Apply that migration in
staging first; it adds unique tenant references, valid date checks, and
PostgreSQL exclusion constraints for overlapping reservations and active
contracts. Run the tenant-isolation, concurrent-booking, payment-ledger, and
backup-restore checks described in `supabase/migrations/README.md` before
production use.
