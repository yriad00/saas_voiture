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
  } catch { /* CI injects env directly. */ }
  return values;
}

const fileEnv = readEnvFile(".env.test.local");
const env = (key) => process.env[key] || fileEnv[key] || "";
const required = ["FLEETHUB_TEST_SUPABASE_URL", "FLEETHUB_TEST_SUPABASE_ANON_KEY", "FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY"];
const skip = required.some((key) => !env(key)) ? "staging credentials are required" : false;
const stagingUrl = () => env("FLEETHUB_TEST_SUPABASE_URL");
const marker = `TEST_E2E_CHECKIN_${crypto.randomUUID().slice(0, 8)}`;
const uuid = () => crypto.randomUUID();
const password = `Test!${crypto.randomBytes(18).toString("base64url")}`;
let admin;
let actor;
let agencyId;
let branchId;
let contractId;
let checkinId;
let client;

before(async () => {
  if (skip) return;
  const host = new URL(stagingUrl()).hostname;
  assert.ok(!host.includes("wewajfotwphufsthfgul"), "atomic check-in tests must never target production");
  admin = createClient(stagingUrl(), env("FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: `${marker.toLowerCase()}@example.invalid`, password, email_confirm: true,
    user_metadata: { full_name: marker },
  });
  assert.ifError(userError);
  actor = userData.user;
  assert.ok(actor?.id);
  assert.ifError((await admin.from("profiles").upsert({ id: actor.id, email: actor.email, full_name: marker })).error);
  const { data: role, error: roleError } = await admin.from("roles").select("id").eq("key", "AGENCY_OWNER").single();
  assert.ifError(roleError);
  agencyId = uuid();
  assert.ifError((await admin.from("agencies").insert({ id: agencyId, name: marker, slug: marker.toLowerCase(), status: "ACTIVE", currency: "MAD", timezone: "Africa/Casablanca", created_by: actor.id })).error);
  assert.ifError((await admin.from("agency_members").insert({ agency_id: agencyId, profile_id: actor.id, role_id: role.id, status: "active" })).error);
  branchId = uuid();
  assert.ifError((await admin.from("branches").insert({ id: branchId, agency_id: agencyId, name: `${marker} Branch`, code: "CHK", city: "Casablanca", active: true })).error);
  const anon = createClient(stagingUrl(), env("FLEETHUB_TEST_SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: signed, error: signError } = await anon.auth.signInWithPassword({ email: actor.email, password });
  assert.ifError(signError);
  client = createClient(stagingUrl(), env("FLEETHUB_TEST_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${signed.session.access_token}` } },
  });

  const customerId = uuid();
  const vehicleId = uuid();
  contractId = uuid();
  assert.ifError((await admin.from("customers").insert({ id: customerId, agency_id: agencyId, first_name: marker, last_name: "Client", id_type: "CIN" })).error);
  assert.ifError((await admin.from("vehicles").insert({ id: vehicleId, agency_id: agencyId, branch_id: branchId, brand: "Dacia", model: marker, year: 2025, license_plate: `${marker}-1`, status: "RENTED", mileage: 10000 })).error);
  assert.ifError((await admin.from("contracts").insert({
    id: contractId, agency_id: agencyId, branch_id: branchId, pickup_branch_id: branchId, return_branch_id: branchId,
    customer_id: customerId, vehicle_id: vehicleId, contract_number: `${marker}-C`, start_date: "2099-01-01", end_date: "2099-01-03",
    status: "ACTIVE", daily_rate: 100, base_total_amount: 200, total_amount: 200, start_mileage: 10000,
    fuel_level_start: 8, mileage_policy: "LIMITED", mileage_allowance: 500, extra_mileage_rate: 1.5,
    fuel_shortfall_rate: 75, cleaning_fee: 180,
  })).error);
  assert.ifError((await admin.from("contract_checkouts").insert({
    agency_id: agencyId, branch_id: branchId, contract_id: contractId, vehicle_id: vehicleId,
    checkout_at: "2099-01-01T10:00:00Z", mileage: 10000, fuel_level: 8, cleanliness: "CLEAN", signature_name: "Test checkout",
  })).error);
  const { data: checkin, error: checkinError } = await admin.from("contract_checkins").insert({
    agency_id: agencyId, branch_id: branchId, contract_id: contractId, vehicle_id: vehicleId,
    actual_return_at: "2099-01-04T12:00:00Z", returned_by: actor.id, return_mileage: 10800, fuel_level: 6,
    cleanliness: "DIRTY", signature_name: "Synthetic customer", status: "REVIEW",
  }).select("id").single();
  assert.ifError(checkinError);
  checkinId = checkin.id;
});

after(async () => {
  if (!admin) return;
  if (agencyId) assert.ifError((await admin.rpc("cleanup_test_agency", { p_agency_id: agencyId })).error);
  if (actor?.id) { await admin.from("agency_members").delete().eq("profile_id", actor.id); await admin.from("profiles").delete().eq("id", actor.id).eq("email", actor.email); await admin.auth.admin.deleteUser(actor.id); }
});

test("check-in finalization is atomic, server-recomputed and retry-safe", { skip }, async () => {
  const args = {
    p_agency_id: agencyId,
    p_contract_id: contractId,
    p_branch_id: branchId,
    p_actual_return_at: "2099-01-04T12:00:00Z",
    p_return_mileage: 10800,
    p_fuel_level: 6,
    p_cleanliness: "DIRTY",
    p_exterior_condition: "Synthetic exterior",
    p_interior_condition: "Synthetic interior",
    p_missing_items: [],
    p_notes: marker,
    p_signature_name: "Synthetic customer",
    p_signature_data: null,
  };

  const withoutPhotos = await client.rpc("finalize_contract_checkin", args);
  assert.ok(withoutPhotos.error, "finalization must require the six return photos");
  const { data: untouchedContract } = await admin.from("contracts").select("end_mileage,return_charges_total").eq("id", contractId).single();
  assert.equal(untouchedContract.end_mileage, null);
  assert.equal(Number(untouchedContract.return_charges_total), 0);

  for (const photoType of ["FRONT", "REAR", "LEFT", "RIGHT", "INTERIOR", "DASHBOARD"]) {
    assert.ifError((await admin.from("contract_inspection_photos").insert({
      agency_id: agencyId, branch_id: branchId, contract_id: contractId, inspection_type: "RETURN",
      photo_type: photoType, storage_path: `${agencyId}/${contractId}/return/${photoType.toLowerCase()}.jpg`,
      file_name: `${photoType}.jpg`, content_type: "image/jpeg", size_bytes: 16, created_by: actor.id,
    })).error);
  }

  const finalized = await client.rpc("finalize_contract_checkin", args);
  assert.ifError(finalized.error);
  assert.equal(finalized.data.status, "FINALIZED");
  assert.equal(Number(finalized.data.late_days), 2);
  assert.equal(Number(finalized.data.extra_mileage), 300);
  assert.equal(Number(finalized.data.fuel_delta), 2);
  assert.equal(Number(finalized.data.automatic_charges), 980);

  const { data: rows, error: rowsError } = await admin.from("return_charges").select("charge_type,amount").eq("contract_id", contractId).eq("source", "AUTOMATIC").order("charge_type");
  assert.ifError(rowsError);
  assert.equal(rows.length, 4);
  assert.equal(rows.reduce((sum, row) => sum + Number(row.amount), 0), 980);
  const { data: persisted } = await admin.from("contract_checkins").select("status,finalized_at").eq("id", checkinId).single();
  assert.equal(persisted.status, "FINALIZED");
  assert.ok(persisted.finalized_at);

  const retry = await client.rpc("finalize_contract_checkin", args);
  assert.ifError(retry.error);
  assert.equal(retry.data.id, finalized.data.id);
  assert.equal(retry.data.replayed, true);
  const { data: afterRetry } = await admin.from("return_charges").select("id").eq("contract_id", contractId).eq("source", "AUTOMATIC");
  assert.equal(afterRetry.length, 4, "retries must not duplicate automatic return charges");
});
