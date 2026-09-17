import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { assertStagingTarget } from "../scripts/staging-target.mjs";

function readEnvFile(file) {
  const values = {};
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) values[match[1]] = match[2].trim();
    }
  } catch { /* CI injects variables directly. */ }
  return values;
}

const fileEnv = readEnvFile(".env.test.local");
const env = (key) => process.env[key] || fileEnv[key] || "";
const required = ["FLEETHUB_TEST_SUPABASE_URL", "FLEETHUB_TEST_SUPABASE_ANON_KEY", "FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY"];
const skip = required.some((key) => !env(key)) ? "staging credentials are required" : false;
const stagingUrl = () => env("FLEETHUB_TEST_SUPABASE_URL");
const marker = `TEST_E2E_EARLY_${crypto.randomUUID().slice(0, 8)}`;
const uuid = () => crypto.randomUUID();
const password = `Test!${crypto.randomBytes(18).toString("base64url")}`;
let admin;
let client;
let actor;
let agencyId;
let branchId;
let customerId;
let vehicleId;
let reservationId;
let contractId;
let recalcVehicleId;
let recalcReservationId;
let recalcContractId;

before(async () => {
  if (skip) return;
  assertStagingTarget(stagingUrl(), "FLEETHUB_TEST_SUPABASE_URL");
  admin = createClient(stagingUrl(), env("FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const created = await admin.auth.admin.createUser({ email: `${marker.toLowerCase()}@example.invalid`, password, email_confirm: true, user_metadata: { full_name: marker } });
  assert.ifError(created.error);
  actor = created.data.user;
  assert.ifError((await admin.from("profiles").upsert({ id: actor.id, email: actor.email, full_name: marker })).error);
  const role = await admin.from("roles").select("id").eq("key", "AGENCY_OWNER").single();
  assert.ifError(role.error);
  agencyId = uuid(); branchId = uuid(); customerId = uuid(); vehicleId = uuid(); reservationId = uuid(); contractId = uuid();
  assert.ifError((await admin.from("agencies").insert({ id: agencyId, name: marker, slug: marker.toLowerCase(), status: "ACTIVE", currency: "MAD", timezone: "Africa/Casablanca", created_by: actor.id })).error);
  assert.ifError((await admin.from("agency_members").insert({ agency_id: agencyId, profile_id: actor.id, role_id: role.data.id, status: "active" })).error);
  assert.ifError((await admin.from("branches").insert({ id: branchId, agency_id: agencyId, name: `${marker} Branch`, code: "EAR", city: "Casablanca", active: true })).error);
  assert.ifError((await admin.from("customers").insert({ id: customerId, agency_id: agencyId, first_name: marker, last_name: "Client", id_type: "CIN" })).error);
  assert.ifError((await admin.from("vehicles").insert({ id: vehicleId, agency_id: agencyId, branch_id: branchId, brand: "Dacia", model: marker, year: 2025, license_plate: `${marker}-1`, status: "RENTED", mileage: 1000 })).error);
  assert.ifError((await admin.from("reservations").insert({ id: reservationId, agency_id: agencyId, branch_id: branchId, pickup_branch_id: branchId, return_branch_id: branchId, customer_id: customerId, vehicle_id: vehicleId, reference: `${marker}-R`, start_date: "2099-02-01", end_date: "2099-02-04", pickup_at: "2099-02-01T09:00:00Z", return_at: "2099-02-04T09:00:00Z", daily_rate: 100, total_days: 3, base_total_amount: 300, total_amount: 300, remaining_amount: 300, status: "ONGOING" })).error);
  assert.ifError((await admin.from("contracts").insert({ id: contractId, agency_id: agencyId, branch_id: branchId, pickup_branch_id: branchId, return_branch_id: branchId, customer_id: customerId, vehicle_id: vehicleId, reservation_id: reservationId, contract_number: `${marker}-C`, start_date: "2099-02-01", end_date: "2099-02-04", start_at: "2099-02-01T09:00:00Z", end_at: "2099-02-04T09:00:00Z", status: "ACTIVE", daily_rate: 100, base_total_amount: 300, total_amount: 300, start_mileage: 1000 })).error);
  assert.ifError((await admin.from("contract_checkins").insert({ agency_id: agencyId, branch_id: branchId, contract_id: contractId, vehicle_id: vehicleId, reservation_id: reservationId, actual_return_at: "2099-02-03T09:00:00Z", returned_by: actor.id, return_mileage: 1100, fuel_level: 8, cleanliness: "CLEAN", signature_name: marker, status: "FINALIZED", finalized_at: "2099-02-03T09:01:00Z", finalized_by: actor.id })).error);
  assert.ifError((await admin.from("contract_inspections").insert({ agency_id: agencyId, branch_id: branchId, contract_id: contractId, inspection_type: "RETURN", inspected_at: "2099-02-03T09:00:00Z", mileage: 1100, fuel_level: 8, signature_name: marker, status: "FINALIZED", finalized_at: "2099-02-03T09:01:00Z", finalized_by: actor.id })).error);
  const anon = createClient(stagingUrl(), env("FLEETHUB_TEST_SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await anon.auth.signInWithPassword({ email: actor.email, password });
  assert.ifError(signed.error);
  client = createClient(stagingUrl(), env("FLEETHUB_TEST_SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${signed.data.session.access_token}` } } });
  const payment = await client.rpc("record_payment_with_cash", { p_agency_id: agencyId, p_branch_id: branchId, p_contract_id: contractId, p_customer_id: customerId, p_amount: 300, p_method: "TRANSFER", p_type: "RENTAL", p_status: "COMPLETED", p_reference: marker, p_paid_at: new Date().toISOString(), p_notes: marker, p_idempotency_key: `${marker}-PAY` });
  assert.ifError(payment.error);

  recalcVehicleId = uuid(); recalcReservationId = uuid(); recalcContractId = uuid();
  assert.ifError((await admin.from("vehicles").insert({ id: recalcVehicleId, agency_id: agencyId, branch_id: branchId, brand: "Renault", model: `${marker}-RECALC`, year: 2025, license_plate: `${marker}-2`, status: "RENTED", mileage: 2000 })).error);
  assert.ifError((await admin.from("reservations").insert({ id: recalcReservationId, agency_id: agencyId, branch_id: branchId, pickup_branch_id: branchId, return_branch_id: branchId, customer_id: customerId, vehicle_id: recalcVehicleId, reference: `${marker}-RR`, start_date: "2099-05-01", end_date: "2099-05-04", pickup_at: "2099-05-01T09:00:00Z", return_at: "2099-05-04T09:00:00Z", daily_rate: 100, total_days: 3, base_total_amount: 300, total_amount: 300, remaining_amount: 300, status: "ONGOING" })).error);
  assert.ifError((await admin.from("contracts").insert({ id: recalcContractId, agency_id: agencyId, branch_id: branchId, pickup_branch_id: branchId, return_branch_id: branchId, customer_id: customerId, vehicle_id: recalcVehicleId, reservation_id: recalcReservationId, contract_number: `${marker}-RC`, start_date: "2099-05-01", end_date: "2099-05-04", start_at: "2099-05-01T09:00:00Z", end_at: "2099-05-04T09:00:00Z", status: "ACTIVE", daily_rate: 100, base_total_amount: 300, total_amount: 300, start_mileage: 2000 })).error);
  assert.ifError((await admin.from("contract_checkins").insert({ agency_id: agencyId, branch_id: branchId, contract_id: recalcContractId, vehicle_id: recalcVehicleId, reservation_id: recalcReservationId, actual_return_at: "2099-05-02T09:00:00Z", returned_by: actor.id, return_mileage: 2100, fuel_level: 8, cleanliness: "CLEAN", signature_name: marker, status: "FINALIZED", finalized_at: "2099-05-02T09:01:00Z", finalized_by: actor.id })).error);
  assert.ifError((await admin.from("contract_inspections").insert({ agency_id: agencyId, branch_id: branchId, contract_id: recalcContractId, inspection_type: "RETURN", inspected_at: "2099-05-02T09:00:00Z", mileage: 2100, fuel_level: 8, signature_name: marker, status: "FINALIZED", finalized_at: "2099-05-02T09:01:00Z", finalized_by: actor.id })).error);
  const recalcPayment = await client?.rpc("record_payment_with_cash", { p_agency_id: agencyId, p_branch_id: branchId, p_contract_id: recalcContractId, p_customer_id: customerId, p_amount: 300, p_method: "TRANSFER", p_type: "RENTAL", p_status: "COMPLETED", p_reference: `${marker}-RECALC-PAY`, p_paid_at: new Date().toISOString(), p_notes: marker, p_idempotency_key: `${marker}-RECALC-PAY` });
  // The client is initialized immediately after the first payment; use admin
  // for setup if the runtime did not expose it yet and assert the row exists.
  if (recalcPayment?.error) throw recalcPayment.error;
});

after(async () => {
  if (!admin) return;
  if (agencyId) assert.ifError((await admin.rpc("cleanup_test_agency", { p_agency_id: agencyId })).error);
  if (actor?.id) {
    await admin.from("agency_members").delete().eq("profile_id", actor.id);
    await admin.from("profiles").delete().eq("id", actor.id).eq("email", actor.email);
    await admin.auth.admin.deleteUser(actor.id);
  }
});

test("early return outcome and refund are atomic and retry-safe", { skip }, async () => {
  const over = await client.rpc("decide_early_return_atomic", { p_agency_id: agencyId, p_contract_id: contractId, p_decision: "PARTIAL_REFUND", p_refund_amount: 301, p_refund_method: "TRANSFER", p_note: marker });
  assert.ok(over.error);
  const { data: before } = await admin.from("contracts").select("early_return_decision,early_return_adjustment").eq("id", contractId).single();
  assert.equal(before.early_return_decision, null);
  const { data: noRefund } = await admin.from("payments").select("id").eq("contract_id", contractId).eq("type", "REFUND");
  assert.equal(noRefund.length, 0);

  const applied = await client.rpc("decide_early_return_atomic", { p_agency_id: agencyId, p_contract_id: contractId, p_decision: "PARTIAL_REFUND", p_refund_amount: 100, p_refund_method: "TRANSFER", p_note: marker });
  assert.ifError(applied.error);
  assert.equal(Number(applied.data.refund_amount), 100);
  const retry = await client.rpc("decide_early_return_atomic", { p_agency_id: agencyId, p_contract_id: contractId, p_decision: "PARTIAL_REFUND", p_refund_amount: 100, p_refund_method: "TRANSFER", p_note: "retry" });
  assert.ifError(retry.error);
  assert.equal(retry.data.replayed, true);
  const { data: afterRetry } = await admin.from("payments").select("id,amount").eq("contract_id", contractId).eq("type", "REFUND");
  assert.equal(afterRetry.length, 1);
  assert.equal(Number(afterRetry[0].amount), 100);
  const { data: finalContract } = await admin.from("contracts").select("early_return_decision,early_return_adjustment").eq("id", contractId).single();
  assert.equal(finalContract.early_return_decision, "PARTIAL_REFUND");
  assert.equal(Number(finalContract.early_return_adjustment), -100);

  // The refund reduces the paid ledger and the negative adjustment reduces the
  // rental total by the same amount, so closure remains fully reconciled.
  const closed = await client.rpc("close_contract_atomic", {
    p_agency_id: agencyId,
    p_contract_id: contractId,
    p_end_mileage: 1100,
    p_fuel_level_end: 8,
  });
  assert.ifError(closed.error);
  const { data: closedContract } = await admin.from("contracts").select("status,final_total_amount").eq("id", contractId).single();
  assert.equal(closedContract.status, "CLOSED");
  assert.equal(Number(closedContract.final_total_amount), 200);
  const { data: closedVehicle } = await admin.from("vehicles").select("status,mileage").eq("id", vehicleId).single();
  assert.equal(closedVehicle.status, "AVAILABLE");
  assert.equal(Number(closedVehicle.mileage), 1100);
});

test("exact timestamp periods allow adjacent same-day handoffs and reject true overlap", { skip }, async () => {
  const first = uuid();
  const second = uuid();
  const base = { agency_id: agencyId, branch_id: branchId, pickup_branch_id: branchId, return_branch_id: branchId, customer_id: customerId, vehicle_id: vehicleId, daily_rate: 100, total_days: 1, base_total_amount: 100, total_amount: 100, remaining_amount: 100, status: "PENDING" };
  const a = await admin.from("reservations").insert({ ...base, id: first, reference: `${marker}-A`, start_date: "2099-03-01", end_date: "2099-03-01", pickup_at: "2099-03-01T09:00:00Z", return_at: "2099-03-01T12:00:00Z" });
  assert.ifError(a.error);
  const adjacent = await admin.from("reservations").insert({ ...base, id: second, reference: `${marker}-B`, start_date: "2099-03-01", end_date: "2099-03-01", pickup_at: "2099-03-01T12:00:00Z", return_at: "2099-03-01T15:00:00Z" });
  assert.ifError(adjacent.error);
  const overlap = await admin.from("reservations").insert({ ...base, id: uuid(), reference: `${marker}-C`, start_date: "2099-03-01", end_date: "2099-03-01", pickup_at: "2099-03-01T11:00:00Z", return_at: "2099-03-01T13:00:00Z" });
  assert.ok(overlap.error);
  await admin.from("reservations").delete().in("id", [first, second]);
});

test("recalculate early return changes the agreed total and closes with one refund", { skip }, async () => {
  const setupPayments = await admin.from("payments").select("amount,type,status").eq("contract_id", recalcContractId);
  assert.ifError(setupPayments.error);
  assert.equal(setupPayments.data.length, 1);
  assert.equal(Number(setupPayments.data[0].amount), 300);
  assert.equal(setupPayments.data[0].type, "RENTAL");
  assert.equal(setupPayments.data[0].status, "COMPLETED");
  const applied = await client.rpc("decide_early_return_atomic", { p_agency_id: agencyId, p_contract_id: recalcContractId, p_decision: "RECALCULATE", p_refund_amount: 0, p_refund_method: "TRANSFER", p_note: marker });
  assert.ifError(applied.error);
  assert.equal(Number(applied.data.adjustment), -200);
  assert.equal(Number(applied.data.refund_amount), 200);
  const retry = await client.rpc("decide_early_return_atomic", { p_agency_id: agencyId, p_contract_id: recalcContractId, p_decision: "RECALCULATE", p_refund_amount: 0, p_refund_method: "TRANSFER", p_note: "retry" });
  assert.ifError(retry.error);
  assert.equal(retry.data.replayed, true);
  const refunds = await admin.from("payments").select("id,amount").eq("contract_id", recalcContractId).eq("type", "REFUND");
  assert.ifError(refunds.error);
  assert.equal(refunds.data.length, 1);
  assert.equal(Number(refunds.data[0].amount), 200);
  const closed = await client.rpc("close_contract_atomic", { p_agency_id: agencyId, p_contract_id: recalcContractId, p_end_mileage: 2100, p_fuel_level_end: 8 });
  assert.ifError(closed.error);
  const contract = await admin.from("contracts").select("status,final_total_amount,early_return_adjustment").eq("id", recalcContractId).single();
  assert.ifError(contract.error);
  assert.equal(contract.data.status, "CLOSED");
  assert.equal(Number(contract.data.final_total_amount), 100);
  assert.equal(Number(contract.data.early_return_adjustment), -200);
});

test("cash payment failure after the payment insert rolls back the payment", { skip }, async () => {
  const key = `${marker}-ROLLBACK-CASH`;
  const response = await client.rpc("record_payment_with_cash", { p_agency_id: agencyId, p_branch_id: branchId, p_contract_id: contractId, p_customer_id: customerId, p_amount: 17, p_method: "CASH", p_type: "RENTAL", p_status: "COMPLETED", p_reference: key, p_paid_at: new Date().toISOString(), p_notes: marker, p_idempotency_key: key });
  assert.ok(response.error, "a cash payment without an open session must fail");
  const persisted = await admin.from("payments").select("id").eq("agency_id", agencyId).eq("idempotency_key", key);
  assert.ifError(persisted.error);
  assert.equal(persisted.data.length, 0, "the failed transaction must not leave the inserted payment behind");
});

test("date-only vehicle blocks remain compatible with timestamp overlap trigger", { skip }, async () => {
  const blockId = uuid();
  const inserted = await admin.from("vehicle_blocks").insert({
    id: blockId,
    agency_id: agencyId,
    branch_id: branchId,
    vehicle_id: vehicleId,
    block_type: "MAINTENANCE",
    reason: `${marker} trigger compatibility`,
    start_date: "2099-04-01",
    end_date: "2099-04-03",
    status: "ACTIVE",
    created_by: actor.id,
  });
  assert.ifError(inserted.error);
  const { data: block } = await admin.from("vehicle_blocks").select("status").eq("id", blockId).single();
  assert.equal(block?.status, "ACTIVE");
  await admin.from("vehicle_blocks").delete().eq("id", blockId);
});
