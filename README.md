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
| 2 | Branches · Vehicles · Customers · Reservations · Calendar | ⏳ Next |
| 3 | Pricing · Extras · Promo codes · Contracts (PDF) | — |
| 4 | Check-in / Check-out · Inspections · Photos | — |
| 5 | Payments · Deposits · Invoices · Refunds | — |
| 6 | Maintenance · Expenses · Profitability | — |
| 7 | Drivers · Deliveries · Notifications | — |
| 8 | Reports · Audit logs · Global search | — |
| 9 | Client portal · Public booking | — |
| 10 | Plans · Subscriptions · Usage limits · Billing | — |
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
   Defaults to `walidtajani084@gmail.com` / `FleetHub!2026`. Change the password after
   first login. Override: `npm run bootstrap:admin -- email pass "Full Name"`.

4. **Run**
   ```bash
   npm run dev
   ```
   Sign in at http://localhost:3000/login.

## Database

Schema is managed as ordered Supabase migrations (`01_…` → `07_…`), applied to project
`wewajfotwphufsthfgul`. Regenerate types after schema changes and replace
`src/lib/database.types.ts`.
# saas_voiture
