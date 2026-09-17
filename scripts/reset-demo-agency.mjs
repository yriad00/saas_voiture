import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const url = process.env.FLEETHUB_TEST_SUPABASE_URL;
const key = process.env.FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Staging env required (FLEETHUB_TEST_SUPABASE_URL / FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY)");
if (!url.includes("nyurwczpxpcpwqamfoek") || url.includes("wewajfotwphufsthfgul")) throw new Error("Refusing to reset: target is not fleethub-staging");

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const e2eRunId = process.env.FLEETHUB_E2E_RUN_ID?.trim().replace(/[^A-Za-z0-9_-]/g, "");
const isolatedE2E = Boolean(e2eRunId);
const DEMO_SLUG = isolatedE2E ? `fleethub-e2e-${e2eRunId.toLowerCase()}` : "fleethub-demo-agency";
const DEMO_NAME = isolatedE2E ? `TEST_E2E_${e2eRunId} FleetHub Demo Agency` : "FleetHub Demo Agency";
const dryRun = process.argv.includes("--dry-run");

let agencyId;
let isolatedAgencyIds = [];

async function removeAgencyRows() {
  if (isolatedE2E) {
    for (const id of isolatedAgencyIds.length ? isolatedAgencyIds : [agencyId]) {
      const { error } = await admin.rpc("cleanup_test_agency", { p_agency_id: id });
      if (error) throw new Error(`cleanup_test_agency: ${error.message}`);
    }
    return;
  }
  // Children are removed before their parent rows. Every delete is scoped to the
  // exact demo agency id resolved from the stable slug/name above.
  const tables = [
    "cash_movements", "cash_sessions", "deposit_transactions", "deposits",
    "return_charge_override_history", "return_charges", "contract_checkins",
    "contract_signatures", "contract_inspection_photos", "contract_inspections",
    "contract_checkouts", "vehicle_preparations", "vehicle_swaps", "rental_extensions",
    "active_rental_updates", "rental_participants", "contract_extras", "reservation_extras",
    "pricing_override_history", "promotions", "pricing_rules", "delivery_missions",
    "vehicle_transfers", "damage_records", "accidents", "fines", "invoices", "payments",
    "expenses", "maintenance_records", "vehicle_owner_settlements", "leads", "audit_logs",
    "contracts", "reservations", "customer_documents", "vehicle_documents", "extras_catalog",
    "customers", "vehicles", "agency_members", "branches", "agency_settings", "subscriptions",
  ];
  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("agency_id", agencyId);
    if (error && !/does not exist|column .* does not exist/i.test(error.message)) throw new Error(`${table}: ${error.message}`);
  }
}

async function removeStorage() {
  for (const bucket of ["customer-documents", "vehicle-documents", "damage-photos", "accident-photos", "contract-photos"]) {
    const paths = [];
    const pending = [agencyId];
    while (pending.length) {
      const prefix = pending.shift();
      const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
      if (error) break;
      for (const item of data ?? []) {
        if (!item.name) continue;
        const itemPath = `${prefix}/${item.name}`;
        // Supabase returns an id for files and null for virtual folders.
        if (item.id) paths.push(itemPath);
        else pending.push(itemPath);
      }
    }
    if (paths.length && !dryRun) await admin.storage.from(bucket).remove(paths);
  }
}

async function removeDemoUsers() {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const user of data.users ?? []) {
      const expectedDomain = isolatedE2E ? "@fleethub-e2e.invalid" : "@fleethub-demo.invalid";
      if (!user.email?.endsWith(expectedDomain)) continue;
      if (isolatedE2E && !user.email.toLowerCase().startsWith(`${e2eRunId.toLowerCase()}-`)) continue;
      const { data: memberships } = await admin.from("agency_members").select("agency_id").eq("profile_id", user.id);
      if ((memberships ?? []).length === 0 && !dryRun) {
        await admin.auth.admin.deleteUser(user.id);
        // Auth user deletion does not guarantee the public profile row is
        // cascaded in every staging schema. Remove only this synthetic user's
        // orphan profile, never a real agency profile.
        const { error: profileError } = await admin.from("profiles").delete().eq("id", user.id).eq("email", user.email);
        if (profileError) throw profileError;
      }
    }
    if ((data.users ?? []).length < 200) break;
    page += 1;
  }
}

async function removeSyntheticEmailRateLimitBuckets() {
  if (!isolatedE2E) return;
  const prefix = e2eRunId.toLowerCase();
  const emails = [
    `${prefix}-owner@fleethub-e2e.invalid`,
    `${prefix}-agent@fleethub-e2e.invalid`,
  ];
  const keys = emails.map((email) => `email:${createHash("sha256").update("email:" + email).digest("hex")}`);
  const { error } = await admin.from("login_rate_limit_buckets").delete().in("bucket_key", keys);
  if (error) throw new Error(`synthetic login bucket cleanup: ${error.message}`);
}

const { data: agency, error: agencyError } = await admin.from("agencies").select("id,name,slug").eq("slug", DEMO_SLUG).maybeSingle();
if (agencyError) throw agencyError;
if (!agency) {
  // The database cleanup helper can remove the tenant before this script gets
  // a chance to run (for example after an interrupted Playwright teardown).
  // Still remove only the isolated run's synthetic Auth users and orphan
  // profiles so a missing agency never leaves credentials behind.
  if (isolatedE2E) {
    await removeDemoUsers();
    await removeSyntheticEmailRateLimitBuckets();
  }
  console.log(JSON.stringify({ reset: false, dryRun, reason: "Demo agency does not exist" }));
  process.exit(0);
}
if (agency.name !== DEMO_NAME || agency.slug !== DEMO_SLUG) throw new Error("Demo agency identity check failed; refusing to continue");
agencyId = agency.id;
if (isolatedE2E) {
  const foreignName = `TEST_E2E_${e2eRunId} FOREIGN`;
  const { data: foreignAgencies, error: foreignError } = await admin.from("agencies").select("id").eq("name", foreignName);
  if (foreignError) throw foreignError;
  isolatedAgencyIds = [agencyId, ...(foreignAgencies ?? []).map((row) => row.id)];
}
if (dryRun) {
  const [{ count: customers }, { count: vehicles }, { count: members }] = await Promise.all([
    admin.from("customers").select("id", { count: "exact", head: true }).eq("agency_id", agencyId),
    admin.from("vehicles").select("id", { count: "exact", head: true }).eq("agency_id", agencyId),
    admin.from("agency_members").select("id", { count: "exact", head: true }).eq("agency_id", agencyId),
  ]);
  console.log(JSON.stringify({ reset: false, dryRun: true, agencyId, customers, vehicles, members }));
  process.exit(0);
}
await removeStorage();
await removeAgencyRows();
await removeDemoUsers();
await removeSyntheticEmailRateLimitBuckets();
const { error: deleted } = await admin.from("agencies").delete().eq("id", agencyId).eq("slug", DEMO_SLUG);
if (deleted) throw deleted;
console.log(JSON.stringify({ reset: true, agencyId, scope: DEMO_SLUG }));
