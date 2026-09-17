import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { assertStagingTarget } from "../../scripts/staging-target.mjs";

const root = process.cwd();
const contextPath = path.join(root, "test-results", ".fleethub-e2e", "context.json");
const resultsDir = path.join(root, "test-results", ".fleethub-e2e");

function readEnvFile(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) values[match[1]] = match[2].replace(/^"|"$/g, "");
  }
  return values;
}

async function verifyFixtureCleanup(testEnv, context) {
  const ids = [context?.fixture?.agency?.id, context?.fixture?.foreign?.agencyId].filter(Boolean);
  if (!ids.length) return;
  const admin = createClient(testEnv.FLEETHUB_TEST_SUPABASE_URL, testEnv.FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
  const leftovers = [];
  for (const table of tables) {
    // A few tenant configuration tables use agency_id as their primary key
    // and do not expose an id column. Count the scoped rows without assuming a
    // particular primary-key name.
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).in("agency_id", ids);
    if (error) throw new Error(`E2E cleanup verification failed on ${table}: ${error.message}`);
    if (count) leftovers.push(`${table}=${count}`);
  }
  const buckets = ["customer-documents", "vehicle-documents", "damage-photos", "accident-photos", "contract-photos"];
  for (const bucket of buckets) {
    for (const agencyId of ids) {
      const pending = [agencyId];
      let count = 0;
      while (pending.length) {
        const prefix = pending.shift();
        const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
        if (error) throw new Error(`E2E Storage cleanup verification failed on ${bucket}: ${error.message}`);
        for (const item of data ?? []) {
          if (!item.name) continue;
          if (item.id) count += 1;
          else pending.push(`${prefix}/${item.name}`);
        }
      }
      if (count) leftovers.push(`storage:${bucket}/${agencyId}=${count}`);
    }
  }
  if (leftovers.length) throw new Error(`E2E fixture cleanup left rows: ${leftovers.join(", ")}`);
}

export default async function globalTeardown() {
  const testEnv = readEnvFile(path.join(root, ".env.test.local"));
  const url = testEnv.FLEETHUB_TEST_SUPABASE_URL || "";
  assertStagingTarget(url, "FLEETHUB_TEST_SUPABASE_URL");
  if (fs.existsSync(contextPath)) {
    const context = JSON.parse(fs.readFileSync(contextPath, "utf8"));
    if (context.e2eRunId) testEnv.FLEETHUB_E2E_RUN_ID = context.e2eRunId;
    const result = spawnSync(process.execPath, ["scripts/reset-demo-agency.mjs"], {
      cwd: root,
      env: { ...process.env, ...testEnv },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status !== 0) throw new Error(`staging E2E cleanup failed:\n${result.stderr || result.stdout}`);
    await verifyFixtureCleanup(testEnv, context);
  }
  const performancePath = path.join(resultsDir, "hosted-performance.json");
  if (fs.existsSync(performancePath)) {
    // Keep the measured values visible in CI output before the isolated
    // results directory is removed.
    console.log(`E2E_PERFORMANCE ${fs.readFileSync(performancePath, "utf8")}`);
  }
  fs.rmSync(resultsDir, { recursive: true, force: true });
}
