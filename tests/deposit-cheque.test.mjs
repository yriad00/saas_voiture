import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
const url = () => env("FLEETHUB_TEST_SUPABASE_URL");
const marker = `TEST_E2E_CHEQUE_${crypto.randomUUID().slice(0, 8)}`;
const uuid = () => crypto.randomUUID();
const password = `Test!${crypto.randomBytes(18).toString("base64url")}`;
let admin;
let client;
let actor;
let agencyId;
let branchId;
let customerId;
let vehicleId;
let contractId;
let depositId;

before(async () => {
  if (skip) return;
  const host = new URL(url()).hostname;
  assert.ok(!host.includes("wewajfotwphufsthfgul"), "cheque tests must never target production");
  admin = createClient(url(), env("FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const created = await admin.auth.admin.createUser({ email: `${marker.toLowerCase()}@example.invalid`, password, email_confirm: true, user_metadata: { full_name: marker } });
  assert.ifError(created.error);
  actor = created.data.user;
  assert.ifError((await admin.from("profiles").upsert({ id: actor.id, email: actor.email, full_name: marker })).error);
  const role = await admin.from("roles").select("id").eq("key", "AGENCY_OWNER").single();
  assert.ifError(role.error);
  agencyId = uuid(); branchId = uuid(); customerId = uuid(); vehicleId = uuid(); contractId = uuid(); depositId = uuid();
  assert.ifError((await admin.from("agencies").insert({ id: agencyId, name: marker, slug: marker.toLowerCase(), status: "ACTIVE", currency: "MAD", timezone: "Africa/Casablanca", created_by: actor.id })).error);
  assert.ifError((await admin.from("agency_members").insert({ agency_id: agencyId, profile_id: actor.id, role_id: role.data.id, status: "active" })).error);
  assert.ifError((await admin.from("branches").insert({ id: branchId, agency_id: agencyId, name: `${marker} Branch`, code: "CHK", city: "Casablanca", active: true })).error);
  assert.ifError((await admin.from("customers").insert({ id: customerId, agency_id: agencyId, first_name: marker, last_name: "Client", id_type: "CIN" })).error);
  assert.ifError((await admin.from("vehicles").insert({ id: vehicleId, agency_id: agencyId, branch_id: branchId, brand: "Dacia", model: marker, year: 2025, license_plate: `${marker}-1`, status: "RENTED", mileage: 1000 })).error);
  assert.ifError((await admin.from("contracts").insert({ id: contractId, agency_id: agencyId, branch_id: branchId, customer_id: customerId, vehicle_id: vehicleId, contract_number: `${marker}-C`, start_date: "2099-05-01", end_date: "2099-05-03", status: "ACTIVE", daily_rate: 100, total_amount: 200 })).error);
  assert.ifError((await admin.from("deposits").insert({ id: depositId, agency_id: agencyId, branch_id: branchId, contract_id: contractId, required_amount: 3000 })).error);
  const anon = createClient(url(), env("FLEETHUB_TEST_SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await anon.auth.signInWithPassword({ email: actor.email, password });
  assert.ifError(signed.error);
  client = createClient(url(), env("FLEETHUB_TEST_SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${signed.data.session.access_token}` } } });
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

test("cheque deposit follows received, held, used and returned lifecycle", { skip }, async () => {
  const received = await client.from("deposit_transactions").insert({
    agency_id: agencyId, branch_id: branchId, deposit_id: depositId, transaction_type: "RECEIVED", amount: 3000,
    reason: `${marker} cheque received`, payment_method: "CHECK", cheque_status: "HELD", idempotency_key: `${marker}-RECEIVE`,
    created_by: actor.id,
  });
  assert.ifError(received.error);
  let state = await admin.from("deposits").select("received_amount,held_amount,deducted_amount,refunded_amount,status,payment_method,cheque_status").eq("id", depositId).single();
  assert.ifError(state.error);
  assert.deepEqual({ ...state.data, received_amount: Number(state.data.received_amount), held_amount: Number(state.data.held_amount), deducted_amount: Number(state.data.deducted_amount), refunded_amount: Number(state.data.refunded_amount) }, {
    received_amount: 3000, held_amount: 3000, deducted_amount: 0, refunded_amount: 0, status: "HELD", payment_method: "CHECK", cheque_status: "HELD",
  });

  const deduction = await client.from("deposit_transactions").insert({
    agency_id: agencyId, branch_id: branchId, deposit_id: depositId, transaction_type: "DEDUCTION", amount: 500,
    reason: `${marker} damage`, payment_method: "CHECK", cheque_status: "DEPOSITED_USED", idempotency_key: `${marker}-DEDUCT`,
    created_by: actor.id,
  });
  assert.ifError(deduction.error);
  state = await admin.from("deposits").select("deducted_amount,status,payment_method,cheque_status").eq("id", depositId).single();
  assert.ifError(state.error);
  assert.equal(Number(state.data.deducted_amount), 500);
  assert.equal(state.data.status, "PARTIALLY_DEDUCTED");
  assert.equal(state.data.cheque_status, "DEPOSITED_USED");

  const refund = await client.from("deposit_transactions").insert({
    agency_id: agencyId, branch_id: branchId, deposit_id: depositId, transaction_type: "REFUND", amount: 2500,
    reason: `${marker} cheque returned`, payment_method: "CHECK", cheque_status: "RETURNED", idempotency_key: `${marker}-REFUND`,
    created_by: actor.id,
  });
  assert.ifError(refund.error);
  state = await admin.from("deposits").select("deducted_amount,refunded_amount,status,payment_method,cheque_status").eq("id", depositId).single();
  assert.ifError(state.error);
  assert.equal(Number(state.data.deducted_amount), 500);
  assert.equal(Number(state.data.refunded_amount), 2500);
  assert.equal(state.data.status, "REFUNDED");
  assert.equal(state.data.cheque_status, "RETURNED");
});

test("cheque metadata constraints and idempotency prevent inconsistent retries", { skip }, async () => {
  const missingState = await client.from("deposit_transactions").insert({
    agency_id: agencyId, branch_id: branchId, deposit_id: depositId, transaction_type: "RECEIVED", amount: 1,
    reason: `${marker} invalid`, payment_method: "CHECK", idempotency_key: `${marker}-INVALID-1`, created_by: actor.id,
  });
  assert.ok(missingState.error, "a cheque must carry an explicit operational state");
  const wrongMethod = await client.from("deposit_transactions").insert({
    agency_id: agencyId, branch_id: branchId, deposit_id: depositId, transaction_type: "REFUND", amount: 1,
    reason: `${marker} invalid`, payment_method: "CASH", cheque_status: "RETURNED", idempotency_key: `${marker}-INVALID-2`, created_by: actor.id,
  });
  assert.ok(wrongMethod.error, "non-cheque deposits cannot carry cheque state");
  const duplicate = await client.from("deposit_transactions").insert({
    agency_id: agencyId, branch_id: branchId, deposit_id: depositId, transaction_type: "REFUND", amount: 1,
    reason: `${marker} retry`, payment_method: "CHECK", cheque_status: "RETURNED", idempotency_key: `${marker}-REFUND`, created_by: actor.id,
  });
  assert.ok(duplicate.error, "reusing a deposit idempotency key must not create a second refund");
  const { data: rows } = await admin.from("deposit_transactions").select("id").eq("agency_id", agencyId).eq("idempotency_key", `${marker}-REFUND`);
  assert.equal(rows.length, 1);
});
