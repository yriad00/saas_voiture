import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { assertStagingTarget } from "../scripts/staging-target.mjs";

function readEnvFile(file) {
  const values = {};
  try { for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) values[m[1]] = m[2].trim(); } } catch { /* CI injects env directly. */ }
  return values;
}
const fileEnv = readEnvFile(".env.test.local");
const env = (key) => process.env[key] || fileEnv[key] || "";
const required = ["FLEETHUB_TEST_SUPABASE_URL", "FLEETHUB_TEST_SUPABASE_ANON_KEY", "FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY"];
const skip = required.some((key) => !env(key)) ? "staging credentials are required" : false;
const url = () => env("FLEETHUB_TEST_SUPABASE_URL");
const marker = `TEST_E2E_CLOSE_${crypto.randomUUID().slice(0, 8)}`;
const uuid = () => crypto.randomUUID();
const password = `Test!${crypto.randomBytes(18).toString("base64url")}`;
let admin; let actor; let client; let agencyId; let branchId; let customerId; let vehicleId; let reservationId; let contractId;

before(async () => {
  if (skip) return;
  assertStagingTarget(url(), "FLEETHUB_TEST_SUPABASE_URL");
  admin = createClient(url(), env("FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const created = await admin.auth.admin.createUser({ email: `${marker.toLowerCase()}@example.invalid`, password, email_confirm: true, user_metadata: { full_name: marker } });
  assert.ifError(created.error); actor = created.data.user;
  assert.ifError((await admin.from("profiles").upsert({ id: actor.id, email: actor.email, full_name: marker })).error);
  const role = await admin.from("roles").select("id").eq("key", "AGENCY_OWNER").single(); assert.ifError(role.error);
  agencyId = uuid(); branchId = uuid(); customerId = uuid(); vehicleId = uuid(); reservationId = uuid(); contractId = uuid();
  assert.ifError((await admin.from("agencies").insert({ id: agencyId, name: marker, slug: marker.toLowerCase(), status: "ACTIVE", currency: "MAD", timezone: "Africa/Casablanca", created_by: actor.id })).error);
  assert.ifError((await admin.from("agency_members").insert({ agency_id: agencyId, profile_id: actor.id, role_id: role.data.id, status: "active" })).error);
  assert.ifError((await admin.from("branches").insert({ id: branchId, agency_id: agencyId, name: `${marker} Branch`, code: "CLS", city: "Casablanca", active: true })).error);
  assert.ifError((await admin.from("customers").insert({ id: customerId, agency_id: agencyId, first_name: marker, last_name: "Client", id_type: "CIN" })).error);
  assert.ifError((await admin.from("vehicles").insert({ id: vehicleId, agency_id: agencyId, branch_id: branchId, brand: "Dacia", model: marker, year: 2025, license_plate: `${marker}-1`, status: "RENTED", mileage: 1000 })).error);
  assert.ifError((await admin.from("reservations").insert({ id: reservationId, agency_id: agencyId, branch_id: branchId, pickup_branch_id: branchId, return_branch_id: branchId, customer_id: customerId, vehicle_id: vehicleId, reference: `${marker}-R`, start_date: "2099-01-01", end_date: "2099-01-02", daily_rate: 100, total_days: 1, base_total_amount: 100, total_amount: 100, remaining_amount: 0, status: "ONGOING" })).error);
  assert.ifError((await admin.from("contracts").insert({ id: contractId, agency_id: agencyId, branch_id: branchId, pickup_branch_id: branchId, return_branch_id: branchId, customer_id: customerId, vehicle_id: vehicleId, reservation_id: reservationId, contract_number: `${marker}-C`, start_date: "2099-01-01", end_date: "2099-01-02", status: "ACTIVE", daily_rate: 100, base_total_amount: 100, total_amount: 100, start_mileage: 1000 })).error);
  assert.ifError((await admin.from("contract_checkins").insert({ agency_id: agencyId, branch_id: branchId, contract_id: contractId, vehicle_id: vehicleId, actual_return_at: "2099-01-02T10:00:00Z", returned_by: actor.id, return_mileage: 1100, fuel_level: 8, cleanliness: "CLEAN", signature_name: "Synthetic customer", status: "FINALIZED", finalized_at: "2099-01-02T10:01:00Z", finalized_by: actor.id })).error);
  assert.ifError((await admin.from("contract_inspections").insert({ agency_id: agencyId, branch_id: branchId, contract_id: contractId, inspection_type: "RETURN", inspected_at: "2099-01-02T10:00:00Z", mileage: 1100, fuel_level: 8, signature_name: "Synthetic customer", status: "FINALIZED", finalized_at: "2099-01-02T10:01:00Z", finalized_by: actor.id })).error);
  const anon = createClient(url(), env("FLEETHUB_TEST_SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await anon.auth.signInWithPassword({ email: actor.email, password }); assert.ifError(signed.error);
  client = createClient(url(), env("FLEETHUB_TEST_SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${signed.data.session.access_token}` } } });
});

after(async () => { if (!admin) return; if (agencyId) assert.ifError((await admin.rpc("cleanup_test_agency", { p_agency_id: agencyId })).error); if (actor?.id) { await admin.from("agency_members").delete().eq("profile_id", actor.id); await admin.from("profiles").delete().eq("id", actor.id).eq("email", actor.email); await admin.auth.admin.deleteUser(actor.id); } });

test("contract closure requires settlement and then commits all state atomically", { skip }, async () => {
  const unsettled = await client.rpc("close_contract_atomic", { p_agency_id: agencyId, p_contract_id: contractId, p_end_mileage: 1100, p_fuel_level_end: 8 });
  assert.ok(unsettled.error);
  assert.match(unsettled.error.message, /balance_unsettled/i);
  const { data: beforePayment } = await admin.from("contracts").select("status,final_total_amount").eq("id", contractId).single();
  assert.equal(beforePayment.status, "ACTIVE");
  assert.equal(beforePayment.final_total_amount, null);

  const payment = await client.rpc("record_payment_with_cash", { p_agency_id: agencyId, p_branch_id: branchId, p_contract_id: contractId, p_customer_id: customerId, p_amount: 100, p_method: "TRANSFER", p_type: "RENTAL", p_status: "COMPLETED", p_reference: marker, p_idempotency_key: `${marker}-PAY` });
  assert.ifError(payment.error);
  const closed = await client.rpc("close_contract_atomic", { p_agency_id: agencyId, p_contract_id: contractId, p_end_mileage: 1100, p_fuel_level_end: 8 });
  assert.ifError(closed.error);
  assert.equal(closed.data.status, "CLOSED");
  assert.equal(Number(closed.data.final_total_amount), 100);
  const [{ data: contract }, { data: reservation }, { data: vehicle }] = await Promise.all([
    admin.from("contracts").select("status,end_mileage,fuel_level_end,final_total_amount").eq("id", contractId).single(),
    admin.from("reservations").select("status").eq("id", reservationId).single(),
    admin.from("vehicles").select("status,mileage,branch_id").eq("id", vehicleId).single(),
  ]);
  assert.equal(contract.status, "CLOSED"); assert.equal(contract.end_mileage, 1100); assert.equal(contract.fuel_level_end, 8); assert.equal(Number(contract.final_total_amount), 100);
  assert.equal(reservation.status, "COMPLETED"); assert.equal(vehicle.status, "AVAILABLE"); assert.equal(vehicle.mileage, 1100); assert.equal(vehicle.branch_id, branchId);
  const retry = await client.rpc("close_contract_atomic", { p_agency_id: agencyId, p_contract_id: contractId, p_end_mileage: 1100, p_fuel_level_end: 8 });
  assert.ifError(retry.error); assert.equal(retry.data.replayed, true);
});
