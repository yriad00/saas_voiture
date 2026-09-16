import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(file) {
  const values = {};
  try { for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/); if (match) values[match[1]] = match[2].trim();
  } } catch { /* CI injects env directly. */ }
  return values;
}
const fileEnv = readEnvFile(".env.test.local");
const env = (key) => process.env[key] || fileEnv[key] || "";
const required = ["FLEETHUB_TEST_SUPABASE_URL", "FLEETHUB_TEST_SUPABASE_ANON_KEY", "FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY"];
const skip = required.some((key) => !env(key)) ? "staging credentials are required" : false;
const url = () => env("FLEETHUB_TEST_SUPABASE_URL");
const marker = `TEST_E2E_ATOMIC_${crypto.randomUUID().slice(0, 8)}`;
const uuid = () => crypto.randomUUID();
let admin;
let authUser;
let agencyId;
let branchId;
let cashSessionId;
let paymentClient;
const password = `Test!${crypto.randomBytes(18).toString("base64url")}`;

before(async () => {
  if (skip) return;
  const host = new URL(url()).hostname;
  assert.ok(!host.includes("wewajfotwphufsthfgul"), "atomic tests must never target production");
  admin = createClient(url(), env("FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: `${marker.toLowerCase()}@example.invalid`, password, email_confirm: true,
    user_metadata: { full_name: marker },
  });
  assert.ifError(userError); authUser = userData.user;
  assert.ok(authUser?.id);
  assert.ifError((await admin.from("profiles").upsert({ id: authUser.id, email: authUser.email, full_name: marker })).error);
  const { data: role, error: roleError } = await admin.from("roles").select("id").eq("key", "AGENCY_OWNER").single();
  assert.ifError(roleError);
  agencyId = uuid();
  assert.ifError((await admin.from("agencies").insert({ id: agencyId, name: marker, slug: marker.toLowerCase(), status: "ACTIVE", currency: "MAD", timezone: "Africa/Casablanca", created_by: authUser.id })).error);
  assert.ifError((await admin.from("agency_members").insert({ agency_id: agencyId, profile_id: authUser.id, role_id: role.id, status: "active" })).error);
  branchId = uuid();
  assert.ifError((await admin.from("branches").insert({ id: branchId, agency_id: agencyId, name: `${marker} Branch`, code: "ATOMIC", city: "Casablanca", active: true })).error);
  assert.ifError((await admin.from("cash_sessions").insert({ agency_id: agencyId, branch_id: branchId, opening_balance: 100, opened_by: authUser.id })).error);
  const { data: session } = await admin.from("cash_sessions").select("id").eq("agency_id", agencyId).eq("branch_id", branchId).single();
  cashSessionId = session.id;
  const anon = createClient(url(), env("FLEETHUB_TEST_SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: signed, error: signError } = await anon.auth.signInWithPassword({ email: authUser.email, password });
  assert.ifError(signError);
  paymentClient = createClient(url(), env("FLEETHUB_TEST_SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${signed.session.access_token}` } } });
});

after(async () => {
  if (!admin) return;
  if (agencyId) assert.ifError((await admin.rpc("cleanup_test_agency", { p_agency_id: agencyId })).error);
  if (authUser?.id) {
    await admin.from("agency_members").delete().eq("profile_id", authUser.id);
    await admin.from("profiles").delete().eq("id", authUser.id).eq("email", authUser.email);
    await admin.auth.admin.deleteUser(authUser.id);
  }
});

test("payment and expense writes are atomic and retry-safe with caisse", { skip }, async () => {
  const customerId = uuid();
  const vehicleId = uuid();
  const contractId = uuid();
  assert.ifError((await admin.from("customers").insert({ id: customerId, agency_id: agencyId, first_name: marker, last_name: "Client", id_type: "CIN" })).error);
  assert.ifError((await admin.from("vehicles").insert({ id: vehicleId, agency_id: agencyId, branch_id: branchId, brand: "Dacia", model: marker, year: 2025, license_plate: `${marker}-1`, status: "AVAILABLE" })).error);
  assert.ifError((await admin.from("contracts").insert({ id: contractId, agency_id: agencyId, branch_id: branchId, customer_id: customerId, vehicle_id: vehicleId, contract_number: `${marker}-C`, start_date: "2099-01-01", end_date: "2099-01-03", status: "ACTIVE", daily_rate: 100, total_amount: 200 })).error);
  const paymentArgs = { p_agency_id: agencyId, p_branch_id: branchId, p_contract_id: contractId, p_customer_id: customerId, p_amount: 200, p_method: "CASH", p_type: "RENTAL", p_status: "COMPLETED", p_reference: marker, p_paid_at: new Date().toISOString(), p_notes: marker, p_idempotency_key: `${marker}-PAY` };
  const first = await paymentClient.rpc("record_payment_with_cash", paymentArgs);
  assert.ifError(first.error); assert.ok(first.data);
  const second = await paymentClient.rpc("record_payment_with_cash", paymentArgs);
  assert.ifError(second.error); assert.equal(second.data, first.data);
  const paymentConflict = await paymentClient.rpc("record_payment_with_cash", { ...paymentArgs, p_amount: 201 });
  assert.ok(paymentConflict.error, "reusing a payment idempotency key with a different payload must fail");
  assert.match(paymentConflict.error.message, /idempotency_key_conflict/i);
  const { data: payments } = await admin.from("payments").select("id").eq("agency_id", agencyId).eq("idempotency_key", `${marker}-PAY`);
  const { data: movements } = await admin.from("cash_movements").select("id,amount").eq("session_id", cashSessionId).eq("reference_id", first.data);
  assert.equal(payments.length, 1); assert.equal(movements.length, 1); assert.equal(Number(movements[0].amount), 200);

  const expenseArgs = { p_agency_id: agencyId, p_branch_id: branchId, p_vehicle_id: vehicleId, p_category: "FUEL", p_amount: 50, p_expense_date: "2099-01-02", p_payment_method: "CASH", p_vendor: marker, p_description: marker, p_idempotency_key: `${marker}-EXP` };
  const expense = await paymentClient.rpc("record_expense_with_cash", expenseArgs);
  assert.ifError(expense.error); assert.ok(expense.data);
  const expenseRetry = await paymentClient.rpc("record_expense_with_cash", expenseArgs);
  assert.ifError(expenseRetry.error); assert.equal(expenseRetry.data, expense.data);
  const expenseConflict = await paymentClient.rpc("record_expense_with_cash", { ...expenseArgs, p_amount: 51 });
  assert.ok(expenseConflict.error, "reusing an expense idempotency key with a different payload must fail");
  assert.match(expenseConflict.error.message, /idempotency_key_conflict/i);
  const { data: expenses } = await admin.from("expenses").select("id").eq("agency_id", agencyId).eq("idempotency_key", `${marker}-EXP`);
  const { data: expenseMoves } = await admin.from("cash_movements").select("id").eq("session_id", cashSessionId).eq("reference_id", expense.data);
  assert.equal(expenses.length, 1); assert.equal(expenseMoves.length, 1);

  const reservationId = uuid();
  assert.ifError((await admin.from("reservations").insert({
    id: reservationId, agency_id: agencyId, branch_id: branchId, pickup_branch_id: branchId, return_branch_id: branchId,
    customer_id: customerId, vehicle_id: null, vehicle_category: "ECONOMY", reference: `${marker}-R`,
    start_date: "2098-01-01", end_date: "2098-01-03", daily_rate: 100, total_days: 2,
    base_total_amount: 200, total_amount: 200, status: "CONFIRMED", advance_amount: 200, remaining_amount: 0,
  })).error);
  const extraId = uuid();
  assert.ifError((await admin.from("extras_catalog").insert({ id: extraId, agency_id: agencyId, branch_id: branchId, code: `${marker}-EXTRA`, name: "Siège test", pricing_type: "PER_UNIT", price: 25, created_by: authUser.id })).error);
  assert.ifError((await admin.from("reservation_extras").insert({ agency_id: agencyId, branch_id: branchId, reservation_id: reservationId, extra_id: extraId, code: `${marker}-EXTRA`, name: "Siège test", pricing_type: "PER_UNIT", quantity: 1, unit_price: 25, total_amount: 25, created_by: authUser.id })).error);
  const { data: plannedReservation } = await admin.from("reservations").select("total_amount,remaining_amount").eq("id", reservationId).single();
  assert.equal(Number(plannedReservation.total_amount), 225);
  assert.equal(Number(plannedReservation.remaining_amount), 225, "expected advance must not reduce the live balance before payment is recorded");
  const reservationPaymentArgs = {
    p_agency_id: agencyId, p_branch_id: branchId, p_reservation_id: reservationId, p_customer_id: customerId,
    p_amount: 225, p_method: "TRANSFER", p_type: "RENTAL", p_status: "COMPLETED", p_reference: marker,
    p_paid_at: new Date().toISOString(), p_notes: marker, p_idempotency_key: `${marker}-RES-PAY`,
  };
  const reservationPayment = await paymentClient.rpc("record_reservation_payment_with_cash", reservationPaymentArgs);
  assert.ifError(reservationPayment.error); assert.ok(reservationPayment.data);
  const reservationRetry = await paymentClient.rpc("record_reservation_payment_with_cash", reservationPaymentArgs);
  assert.ifError(reservationRetry.error); assert.equal(reservationRetry.data, reservationPayment.data);
  const reservationConflict = await paymentClient.rpc("record_reservation_payment_with_cash", { ...reservationPaymentArgs, p_amount: 199 });
  assert.ok(reservationConflict.error, "reservation payment idempotency conflicts must fail");
  assert.match(reservationConflict.error.message, /idempotency_key_conflict/i);
  const { data: linkedPayment } = await admin.from("payments").select("reservation_id").eq("id", reservationPayment.data).single();
  assert.equal(linkedPayment.reservation_id, reservationId);
  const { data: paidReservation } = await admin.from("reservations").select("remaining_amount").eq("id", reservationId).single();
  assert.equal(Number(paidReservation.remaining_amount), 0);
  const reservationRefund = await paymentClient.rpc("record_reservation_payment_with_cash", { ...reservationPaymentArgs, p_amount: 50, p_type: "REFUND", p_idempotency_key: `${marker}-RES-REFUND` });
  assert.ifError(reservationRefund.error); assert.ok(reservationRefund.data);
  const reservationRefundRetry = await paymentClient.rpc("record_reservation_payment_with_cash", { ...reservationPaymentArgs, p_amount: 50, p_type: "REFUND", p_idempotency_key: `${marker}-RES-REFUND` });
  assert.ifError(reservationRefundRetry.error); assert.equal(reservationRefundRetry.data, reservationRefund.data);
  const reservationOverRefund = await paymentClient.rpc("record_reservation_payment_with_cash", { ...reservationPaymentArgs, p_amount: 176, p_type: "REFUND", p_idempotency_key: `${marker}-RES-OVER-REFUND` });
  assert.ok(reservationOverRefund.error, "reservation refunds must never exceed the remaining advance");
  const { data: refundedReservation } = await admin.from("reservations").select("remaining_amount").eq("id", reservationId).single();
  assert.equal(Number(refundedReservation.remaining_amount), 50);

  const missingSessionBranch = uuid();
  assert.ifError((await admin.from("branches").insert({ id: missingSessionBranch, agency_id: agencyId, name: `${marker} Closed`, code: "CLOSED", city: "Casablanca", active: true })).error);
  const failed = await paymentClient.rpc("record_payment_with_cash", { ...paymentArgs, p_branch_id: missingSessionBranch, p_contract_id: null, p_customer_id: null, p_idempotency_key: `${marker}-FAIL` });
  assert.ok(failed.error, "cash payment without an open session must fail");
  const { data: failedRows } = await admin.from("payments").select("id").eq("agency_id", agencyId).eq("idempotency_key", `${marker}-FAIL`);
  assert.equal(failedRows.length, 0, "failed atomic operation left a payment row behind");
});
