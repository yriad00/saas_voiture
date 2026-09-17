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
  } catch { /* CI injects env directly. */ }
  return values;
}

const fileEnv = readEnvFile(".env.test.local");
const env = (key) => process.env[key] || fileEnv[key] || "";
const required = ["FLEETHUB_TEST_SUPABASE_URL", "FLEETHUB_TEST_SUPABASE_ANON_KEY", "FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY"];
const skip = required.some((key) => !env(key)) ? "staging credentials are required" : false;
const stagingUrl = () => env("FLEETHUB_TEST_SUPABASE_URL");
const marker = `TEST_E2E_OUTCOME_${crypto.randomUUID().slice(0, 8)}`;
const uuid = () => crypto.randomUUID();
const password = `Test!${crypto.randomBytes(18).toString("base64url")}`;
let admin;
let actor;
let agencyId;
let branchId;
let reservationId;
let client;

before(async () => {
  if (skip) return;
  assertStagingTarget(stagingUrl(), "FLEETHUB_TEST_SUPABASE_URL");
  admin = createClient(stagingUrl(), env("FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await admin.auth.admin.createUser({ email: `${marker.toLowerCase()}@example.invalid`, password, email_confirm: true, user_metadata: { full_name: marker } });
  assert.ifError(userError); actor = userData.user; assert.ok(actor?.id);
  assert.ifError((await admin.from("profiles").upsert({ id: actor.id, email: actor.email, full_name: marker })).error);
  const { data: role, error: roleError } = await admin.from("roles").select("id").eq("key", "AGENCY_OWNER").single();
  assert.ifError(roleError);
  agencyId = uuid(); branchId = uuid(); reservationId = uuid();
  assert.ifError((await admin.from("agencies").insert({ id: agencyId, name: marker, slug: marker.toLowerCase(), status: "ACTIVE", currency: "MAD", timezone: "Africa/Casablanca", created_by: actor.id })).error);
  assert.ifError((await admin.from("agency_members").insert({ agency_id: agencyId, profile_id: actor.id, role_id: role.id, status: "active" })).error);
  assert.ifError((await admin.from("branches").insert({ id: branchId, agency_id: agencyId, name: `${marker} Branch`, code: "OUT", city: "Casablanca", active: true })).error);
  const customerId = uuid(); const vehicleId = uuid();
  assert.ifError((await admin.from("customers").insert({ id: customerId, agency_id: agencyId, first_name: marker, last_name: "Client", id_type: "CIN" })).error);
  assert.ifError((await admin.from("vehicles").insert({ id: vehicleId, agency_id: agencyId, branch_id: branchId, brand: "Dacia", model: marker, year: 2025, license_plate: `${marker}-1`, status: "RESERVED" })).error);
  assert.ifError((await admin.from("reservations").insert({
    id: reservationId, agency_id: agencyId, branch_id: branchId, pickup_branch_id: branchId, return_branch_id: branchId,
    customer_id: customerId, vehicle_id: vehicleId, reference: `${marker}-R`, start_date: "2099-01-01", end_date: "2099-01-03",
    daily_rate: 150, total_days: 2, base_total_amount: 300, total_amount: 300, remaining_amount: 300,
    advance_amount: 300, deposit_amount: 0, status: "CONFIRMED",
  })).error);
  const anon = createClient(stagingUrl(), env("FLEETHUB_TEST_SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: signed, error: signError } = await anon.auth.signInWithPassword({ email: actor.email, password });
  assert.ifError(signError);
  client = createClient(stagingUrl(), env("FLEETHUB_TEST_SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${signed.session.access_token}` } } });
  const payment = await client.rpc("record_reservation_payment_with_cash", {
    p_agency_id: agencyId, p_branch_id: branchId, p_reservation_id: reservationId, p_customer_id: customerId,
    p_amount: 300, p_method: "TRANSFER", p_type: "RENTAL", p_status: "COMPLETED", p_reference: marker,
    p_paid_at: new Date().toISOString(), p_notes: marker, p_idempotency_key: `${marker}-PAY`,
  });
  assert.ifError(payment.error);
});

after(async () => {
  if (!admin) return;
  if (agencyId) assert.ifError((await admin.rpc("cleanup_test_agency", { p_agency_id: agencyId })).error);
  if (actor?.id) { await admin.from("agency_members").delete().eq("profile_id", actor.id); await admin.from("profiles").delete().eq("id", actor.id).eq("email", actor.email); await admin.auth.admin.deleteUser(actor.id); }
});

test("cancellation/no-show outcome commits refund and vehicle status atomically", { skip }, async () => {
  const failed = await client.rpc("set_reservation_status_financial", {
    p_agency_id: agencyId, p_reservation_id: reservationId, p_status: "CANCELLED",
    p_reason: "Synthetic over-refund", p_refund_amount: 301, p_refund_method: "TRANSFER",
  });
  assert.ok(failed.error, "an over-refund must fail");
  const { data: stillConfirmed } = await admin.from("reservations").select("status,cancellation_refund_amount").eq("id", reservationId).single();
  assert.equal(stillConfirmed.status, "CONFIRMED");
  assert.equal(Number(stillConfirmed.cancellation_refund_amount), 0);
  const { data: noRefundRows } = await admin.from("payments").select("id").eq("reservation_id", reservationId).eq("type", "REFUND");
  assert.equal(noRefundRows.length, 0);

  const cancelled = await client.rpc("set_reservation_status_financial", {
    p_agency_id: agencyId, p_reservation_id: reservationId, p_status: "CANCELLED",
    p_reason: "Synthetic customer request", p_refund_amount: 100, p_refund_method: "TRANSFER",
  });
  assert.ifError(cancelled.error);
  assert.equal(cancelled.data.status, "CANCELLED");
  assert.equal(Number(cancelled.data.refund_amount), 100);
  const { data: state } = await admin.from("reservations").select("status,cancellation_refund_amount").eq("id", reservationId).single();
  assert.equal(state.status, "CANCELLED");
  assert.equal(Number(state.cancellation_refund_amount), 100);
  const { data: refundRows } = await admin.from("payments").select("id,amount,type").eq("reservation_id", reservationId).eq("type", "REFUND");
  assert.equal(refundRows.length, 1);
  assert.equal(Number(refundRows[0].amount), 100);
  const { data: vehicle } = await admin.from("vehicles").select("status").eq("agency_id", agencyId).limit(1).single();
  assert.equal(vehicle.status, "AVAILABLE");

  const retry = await client.rpc("set_reservation_status_financial", {
    p_agency_id: agencyId, p_reservation_id: reservationId, p_status: "CANCELLED",
    p_reason: "Retry", p_refund_amount: 100, p_refund_method: "TRANSFER",
  });
  assert.ifError(retry.error);
  assert.equal(retry.data.replayed, true);
  const { data: afterRetry } = await admin.from("payments").select("id").eq("reservation_id", reservationId).eq("type", "REFUND");
  assert.equal(afterRetry.length, 1);

  const conflict = await client.rpc("set_reservation_status_financial", {
    p_agency_id: agencyId, p_reservation_id: reservationId, p_status: "CANCELLED",
    p_reason: "Changed amount", p_refund_amount: 101, p_refund_method: "TRANSFER",
  });
  assert.ok(conflict.error);
  assert.match(conflict.error.message, /idempotency_key_conflict/i);
});
