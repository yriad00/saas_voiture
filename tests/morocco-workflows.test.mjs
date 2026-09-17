import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { assertStagingTarget } from "../scripts/staging-target.mjs";

// These tests use an isolated test Supabase project and TEST_E2E tenants only.
// No personal data, cards or messages. Production .env.local is never used to mutate data.
function readEnvFile(path) {
  const values = {};
  try {
    for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !match[2].startsWith("#")) values[match[1]] = match[2].trim();
    }
  } catch {
    // CI may provide environment variables directly.
  }
  return values;
}

const fileEnv = readEnvFile(".env.test.local");
const productionEnv = readEnvFile(".env.local");
const env = (key) => process.env[key] || fileEnv[key] || "";
const required = ["FLEETHUB_TEST_SUPABASE_URL", "FLEETHUB_TEST_SUPABASE_ANON_KEY", "FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY"];
const skip = required.every(env) ? false : "Separate FLEETHUB_TEST_SUPABASE_* credentials are required; production credentials are prohibited.";
const testUrl = () => env("FLEETHUB_TEST_SUPABASE_URL");
const testAnonKey = () => env("FLEETHUB_TEST_SUPABASE_ANON_KEY");
const testServiceKey = () => env("FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY");
const marker = `TEST_E2E_${crypto.randomUUID().slice(0, 8)}`;
const uuid = () => crypto.randomUUID();
const created = { users: [], agencies: [] };
const fixture = {};
let admin;
let ownerA;
let ownerB;
let branchAgent;
let migrationReady = false;

if (required.every(env)) assertStagingTarget(testUrl(), "FLEETHUB_TEST_SUPABASE_URL");

async function createUser(label) {
  const email = `${marker.toLowerCase()}-${label}@example.invalid`;
  const password = `Test!${crypto.randomBytes(18).toString("base64url")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: `${marker} ${label}` },
  });
  assert.ifError(error);
  assert.ok(data.user?.id);
  const user = { id: data.user.id, email, password };
  created.users.push(user);
  const profile = await admin.from("profiles").upsert({
    id: user.id, email, full_name: `${marker} ${label}`, is_super_admin: false,
  });
  assert.ifError(profile.error);
  return user;
}

async function createAgency(label, member, roleId) {
  const agencyId = uuid();
  const result = await admin.from("agencies").insert({
    id: agencyId, name: `${marker} Agency ${label}`,
    slug: `${marker.toLowerCase()}-${label.toLowerCase()}`,
    status: "ACTIVE", currency: "MAD", timezone: "Africa/Casablanca",
    created_by: member.id,
  });
  assert.ifError(result.error);
  created.agencies.push(agencyId);
  const membership = await admin.from("agency_members").insert({
    agency_id: agencyId, profile_id: member.id, role_id: roleId,
    status: "active", joined_at: new Date().toISOString(),
  });
  assert.ifError(membership.error);
  return agencyId;
}

async function row(table, payload) {
  const { data, error } = await admin.from(table).insert(payload).select("id").single();
  assert.ifError(error, `Could not create ${marker} ${table} fixture`);
  assert.ok(data?.id);
  return data.id;
}

async function signIn(user) {
  const auth = createClient(testUrl(), testAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.ifError(error);
  assert.ok(data.session?.access_token);
  return createClient(testUrl(), testAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

async function setup() {
  if (skip) return;
  const testHost = assertStagingTarget(testUrl(), "FLEETHUB_TEST_SUPABASE_URL").hostname;
  const productionHost = productionEnv.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(productionEnv.NEXT_PUBLIC_SUPABASE_URL).hostname : "";
  assert.notEqual(testHost, productionHost, "The Morocco workflow tests cannot target the production Supabase project");
  admin = createClient(testUrl(), testServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const migration = await admin.from("rental_participants").select("id").limit(0);
  assert.ifError(migration.error, "Migration 0064 must be applied before running Morocco workflow tests");
  migrationReady = true;
  const roles = await admin.from("roles").select("id,key").in("key", ["AGENCY_OWNER", "AGENT"]);
  assert.ifError(roles.error);
  const ownerRole = roles.data.find((role) => role.key === "AGENCY_OWNER")?.id;
  const agentRole = roles.data.find((role) => role.key === "AGENT")?.id;
  assert.ok(ownerRole && agentRole, "Seed owner and agent roles before running these tests");

  fixture.userA = await createUser("owner-a");
  fixture.userB = await createUser("owner-b");
  fixture.userBranch = await createUser("branch-agent");
  fixture.agencyA = await createAgency("A", fixture.userA, ownerRole);
  fixture.agencyB = await createAgency("B", fixture.userB, ownerRole);
  fixture.branchA1 = await row("branches", { id: uuid(), agency_id: fixture.agencyA,
    name: `${marker} Casablanca`, code: "A1", city: "Casablanca", active: true });
  fixture.branchA2 = await row("branches", { id: uuid(), agency_id: fixture.agencyA,
    name: `${marker} Marrakech`, code: "A2", city: "Marrakech", active: true });
  fixture.branchB = await row("branches", { id: uuid(), agency_id: fixture.agencyB,
    name: `${marker} Tanger`, code: "B1", city: "Tanger", active: true });
  const member = await admin.from("agency_members").insert({
    agency_id: fixture.agencyA, profile_id: fixture.userBranch.id, role_id: agentRole,
    branch_id: fixture.branchA1, status: "active", joined_at: new Date().toISOString(),
  });
  assert.ifError(member.error);
  fixture.customerA = await row("customers", { id: uuid(), agency_id: fixture.agencyA,
    first_name: marker, last_name: "Client A", id_type: "CIN" });
  fixture.customerB = await row("customers", { id: uuid(), agency_id: fixture.agencyB,
    first_name: marker, last_name: "Client B", id_type: "CIN" });
  fixture.vehicleA1 = await row("vehicles", { id: uuid(), agency_id: fixture.agencyA,
    branch_id: fixture.branchA1, brand: "Dacia", model: marker, year: 2024,
    license_plate: `${marker}-A1`, status: "AVAILABLE", ownership_type: "SUBLEASE" });
  fixture.vehicleA2 = await row("vehicles", { id: uuid(), agency_id: fixture.agencyA,
    branch_id: fixture.branchA2, brand: "Dacia", model: marker, year: 2024,
    license_plate: `${marker}-A2`, status: "AVAILABLE", ownership_type: "SUBLEASE" });
  fixture.vehicleAFree = await row("vehicles", { id: uuid(), agency_id: fixture.agencyA,
    branch_id: fixture.branchA1, brand: "Dacia", model: marker, year: 2024,
    license_plate: `${marker}-AF`, status: "AVAILABLE", ownership_type: "SUBLEASE" });
  fixture.vehicleB = await row("vehicles", { id: uuid(), agency_id: fixture.agencyB,
    branch_id: fixture.branchB, brand: "Dacia", model: marker, year: 2024,
    license_plate: `${marker}-B`, status: "AVAILABLE", ownership_type: "SUBLEASE" });
  fixture.contractA = await row("contracts", { id: uuid(), agency_id: fixture.agencyA,
    branch_id: fixture.branchA1, customer_id: fixture.customerA, vehicle_id: fixture.vehicleA1,
    contract_number: `${marker}-CON-A`, start_date: "2099-01-01", end_date: "2099-01-04",
    status: "CLOSED", daily_rate: 300, total_amount: 900 });
  fixture.contractA2 = await row("contracts", { id: uuid(), agency_id: fixture.agencyA,
    branch_id: fixture.branchA2, customer_id: fixture.customerA, vehicle_id: fixture.vehicleA2,
    contract_number: `${marker}-CON-A2`, start_date: "2099-01-01", end_date: "2099-01-04",
    status: "CLOSED", daily_rate: 300, total_amount: 900 });
  fixture.contractB = await row("contracts", { id: uuid(), agency_id: fixture.agencyB,
    branch_id: fixture.branchB, customer_id: fixture.customerB, vehicle_id: fixture.vehicleB,
    contract_number: `${marker}-CON-B`, start_date: "2099-01-01", end_date: "2099-01-04",
    status: "CLOSED", daily_rate: 300, total_amount: 900 });
  ownerA = await signIn(fixture.userA);
  ownerB = await signIn(fixture.userB);
  branchAgent = await signIn(fixture.userBranch);
}

before(setup, { skip });

test("category reservation can be created unassigned, then only assigned to a free vehicle", { skip }, async () => {
  const categoryId = uuid();
  const category = await ownerA.from("reservations").insert({
    id: categoryId, agency_id: fixture.agencyA, branch_id: fixture.branchA1,
    customer_id: fixture.customerA, vehicle_id: null, vehicle_category: "Economique",
    pickup_branch_id: fixture.branchA1, return_branch_id: fixture.branchA2, one_way_fee: 75,
    reference: `${marker}-CATEGORY`, start_date: "2099-07-01", end_date: "2099-07-03",
    status: "CONFIRMED", daily_rate: 200, total_days: 2, total_amount: 400,
  }).select("id,vehicle_id,vehicle_category,return_branch_id,one_way_fee").single();
  assert.ifError(category.error);
  assert.equal(category.data.vehicle_id, null);
  assert.equal(category.data.vehicle_category, "Economique");
  assert.equal(category.data.return_branch_id, fixture.branchA2);
  assert.equal(Number(category.data.one_way_fee), 75);

  const concreteId = uuid();
  const concrete = await ownerA.from("reservations").insert({
    id: concreteId, agency_id: fixture.agencyA, branch_id: fixture.branchA1,
    customer_id: fixture.customerA, vehicle_id: fixture.vehicleA1,
    reference: `${marker}-CONCRETE`, start_date: "2099-07-01", end_date: "2099-07-03",
    status: "CONFIRMED", daily_rate: 200, total_days: 2, total_amount: 400,
  });
  assert.ifError(concrete.error, "A category-only reservation should not lock a vehicle");
  const conflict = await ownerA.from("reservations").update({ vehicle_id: fixture.vehicleA1 })
    .eq("id", categoryId).select("id");
  assert.ok(conflict.error || conflict.data?.length === 0, "A booked vehicle was assigned twice");
  const free = await ownerA.from("reservations").update({ vehicle_id: fixture.vehicleAFree })
    .eq("id", categoryId).is("vehicle_id", null).select("vehicle_id").single();
  assert.ifError(free.error);
  assert.equal(free.data.vehicle_id, fixture.vehicleAFree);
});

test("active customer CIN and email duplicates are rejected by the database guard", { skip }, async () => {
  const cin = `${marker}-CIN-DUP`;
  const email = `${marker.toLowerCase()}-duplicate@example.invalid`;
  const update = await ownerA.from("customers").update({ id_number: cin, email }).eq("id", fixture.customerA).eq("agency_id", fixture.agencyA);
  assert.ifError(update.error);
  const duplicateCin = await ownerA.from("customers").insert({
    agency_id: fixture.agencyA, first_name: marker, last_name: "Duplicate CIN", id_type: "CIN", id_number: cin,
  });
  assert.ok(duplicateCin.error);
  assert.equal(duplicateCin.error.code, "23505");
  const duplicateEmail = await ownerA.from("customers").insert({
    agency_id: fixture.agencyA, first_name: marker, last_name: "Duplicate Email", id_type: "CIN", email,
  });
  assert.ok(duplicateEmail.error);
  assert.equal(duplicateEmail.error.code, "23505");
  const retiredId = await row("customers", { id: uuid(), agency_id: fixture.agencyA, first_name: marker, last_name: "Retired", id_type: "CIN", id_number: `${marker}-RETIRED` });
  assert.ifError((await admin.from("customers").update({ deleted_at: new Date().toISOString() }).eq("id", retiredId).eq("agency_id", fixture.agencyA)).error);
  const replacement = await ownerA.from("customers").insert({
    agency_id: fixture.agencyA, first_name: marker, last_name: "Replacement", id_type: "CIN", id_number: `${marker}-RETIRED`,
  });
  assert.ifError(replacement.error);
});

test("no-show releases the exact vehicle dates for a new booking", { skip }, async () => {
  const absentId = uuid();
  const absent = await ownerA.from("reservations").insert({
    id: absentId, agency_id: fixture.agencyA, branch_id: fixture.branchA1,
    customer_id: fixture.customerA, vehicle_id: fixture.vehicleA1,
    reference: `${marker}-NO-SHOW`, start_date: "2099-10-01", end_date: "2099-10-03",
    status: "CONFIRMED", daily_rate: 200, total_days: 2, total_amount: 400,
  });
  assert.ifError(absent.error);
  const marked = await ownerA.from("reservations").update({
    status: "NO_SHOW", cancellation_reason: marker,
    cancelled_at: new Date().toISOString(),
  }).eq("id", absentId).select("status").single();
  assert.ifError(marked.error);
  assert.equal(marked.data.status, "NO_SHOW");
  const replacement = await ownerA.from("reservations").insert({
    id: uuid(), agency_id: fixture.agencyA, branch_id: fixture.branchA1,
    customer_id: fixture.customerA, vehicle_id: fixture.vehicleA1,
    reference: `${marker}-AFTER-NO-SHOW`, start_date: "2099-10-01", end_date: "2099-10-03",
    status: "CONFIRMED", daily_rate: 200, total_days: 2, total_amount: 400,
  });
  assert.ifError(replacement.error, "No-show continued blocking the vehicle");
});

test("one-way branches and payer/driver fields reject foreign tenant references", { skip }, async () => {
  const valid = await ownerA.from("contracts").update({
    pickup_branch_id: fixture.branchA1, return_branch_id: fixture.branchA2,
    one_way_fee: 100, payer_customer_id: fixture.customerA,
    principal_driver_customer_id: fixture.customerA,
  }).eq("id", fixture.contractA).select("return_branch_id,one_way_fee").single();
  assert.ifError(valid.error);
  assert.equal(valid.data.return_branch_id, fixture.branchA2);
  assert.equal(Number(valid.data.one_way_fee), 100);

  for (const fields of [
    { return_branch_id: fixture.branchB },
    { pickup_branch_id: fixture.branchB },
    { payer_customer_id: fixture.customerB },
    { principal_driver_customer_id: fixture.customerB },
  ]) {
    const wrong = await ownerA.from("contracts").update(fields).eq("id", fixture.contractA).select("id");
    assert.ok(wrong.error || wrong.data?.length === 0,
      `Contract accepted foreign tenant reference ${Object.keys(fields)[0]}`);
  }

  const reservation = await ownerA.from("reservations").insert({
    id: uuid(), agency_id: fixture.agencyA, branch_id: fixture.branchA1,
    customer_id: fixture.customerA, vehicle_category: "Economique",
    pickup_branch_id: fixture.branchA1, return_branch_id: fixture.branchB,
    reference: `${marker}-FOREIGN-BRANCH`, start_date: "2099-08-01", end_date: "2099-08-03",
    status: "PENDING", daily_rate: 200, total_days: 2, total_amount: 400,
  });
  assert.ok(reservation.error, "Reservation accepted a foreign tenant return branch");
});

test("participants and supplier settlements enforce tenant and branch isolation", { skip }, async () => {
  const participantB = await ownerB.from("rental_participants").insert({
    id: uuid(), agency_id: fixture.agencyB, branch_id: fixture.branchB,
    contract_id: fixture.contractB, customer_id: fixture.customerB,
    role: "PRINCIPAL_DRIVER", notes: marker, created_by: fixture.userB.id,
  }).select("id").single();
  assert.ifError(participantB.error);
  const hiddenParticipant = await ownerA.from("rental_participants").select("id")
    .eq("id", participantB.data.id);
  assert.ifError(hiddenParticipant.error);
  assert.equal(hiddenParticipant.data.length, 0, "Tenant A read Tenant B rental participant");
  const foreignAgencyParticipant = await ownerA.from("rental_participants").insert({
    id: uuid(), agency_id: fixture.agencyB, branch_id: fixture.branchB,
    contract_id: fixture.contractB, customer_id: fixture.customerB, role: "PAYER",
  }).select("id");
  assert.ok(foreignAgencyParticipant.error || foreignAgencyParticipant.data?.length === 0,
    "Tenant A inserted Tenant B participant");
  const foreignContract = await ownerA.from("rental_participants").insert({
    id: uuid(), agency_id: fixture.agencyA, branch_id: fixture.branchA1,
    contract_id: fixture.contractB, customer_id: fixture.customerA, role: "PAYER",
  });
  assert.ok(foreignContract.error, "Participant linked Tenant A row to Tenant B contract");
  const foreignCustomer = await ownerA.from("rental_participants").insert({
    id: uuid(), agency_id: fixture.agencyA, branch_id: fixture.branchA1,
    contract_id: fixture.contractA, customer_id: fixture.customerB, role: "PAYER",
  });
  assert.ok(foreignCustomer.error, "Participant linked Tenant A row to Tenant B customer");
  const participantA2 = await ownerA.from("rental_participants").insert({
    id: uuid(), agency_id: fixture.agencyA, branch_id: fixture.branchA2,
    contract_id: fixture.contractA2, customer_id: fixture.customerA,
    role: "ADDITIONAL_DRIVER", notes: marker,
  }).select("id").single();
  assert.ifError(participantA2.error);
  const branchHidden = await branchAgent.from("rental_participants").select("id")
    .eq("id", participantA2.data.id);
  assert.ifError(branchHidden.error);
  assert.equal(branchHidden.data.length, 0, "Branch A1 read Branch A2 participant");

  const settlementB = await ownerB.from("vehicle_owner_settlements").insert({
    id: uuid(), agency_id: fixture.agencyB, branch_id: fixture.branchB,
    vehicle_id: fixture.vehicleB, contract_id: fixture.contractB,
    owner_name: `${marker} Supplier B`, rental_revenue: 900, owner_amount: 600,
    agency_margin: 300, paid_amount: 0, status: "UNPAID",
  }).select("id").single();
  assert.ifError(settlementB.error);
  const hiddenSettlement = await ownerA.from("vehicle_owner_settlements").select("id")
    .eq("id", settlementB.data.id);
  assert.ifError(hiddenSettlement.error);
  assert.equal(hiddenSettlement.data.length, 0, "Tenant A read Tenant B owner settlement");
  const foreignAgencySettlement = await ownerA.from("vehicle_owner_settlements").insert({
    id: uuid(), agency_id: fixture.agencyB, branch_id: fixture.branchB,
    vehicle_id: fixture.vehicleB, contract_id: fixture.contractB,
    owner_name: marker, rental_revenue: 900, owner_amount: 600,
  }).select("id");
  assert.ok(foreignAgencySettlement.error || foreignAgencySettlement.data?.length === 0,
    "Tenant A inserted Tenant B settlement");
  const foreignVehicleSettlement = await ownerA.from("vehicle_owner_settlements").insert({
    id: uuid(), agency_id: fixture.agencyA, branch_id: fixture.branchA1,
    vehicle_id: fixture.vehicleB, contract_id: fixture.contractA,
    owner_name: marker, rental_revenue: 900, owner_amount: 600,
  });
  assert.ok(foreignVehicleSettlement.error, "Tenant A settlement linked Tenant B vehicle");
  const foreignContractSettlement = await ownerA.from("vehicle_owner_settlements").insert({
    id: uuid(), agency_id: fixture.agencyA, branch_id: fixture.branchA1,
    vehicle_id: fixture.vehicleA1, contract_id: fixture.contractB,
    owner_name: marker, rental_revenue: 900, owner_amount: 600,
  });
  assert.ok(foreignContractSettlement.error, "Tenant A settlement linked Tenant B contract");
  const settlementA2 = await ownerA.from("vehicle_owner_settlements").insert({
    id: uuid(), agency_id: fixture.agencyA, branch_id: fixture.branchA2,
    vehicle_id: fixture.vehicleA2, contract_id: fixture.contractA2,
    owner_name: `${marker} Supplier A2`, rental_revenue: 900,
    owner_amount: 600, agency_margin: 300,
  }).select("id").single();
  assert.ifError(settlementA2.error);
  const branchSettlement = await branchAgent.from("vehicle_owner_settlements").select("id")
    .eq("id", settlementA2.data.id);
  assert.ifError(branchSettlement.error);
  assert.equal(branchSettlement.data.length, 0, "Branch A1 read Branch A2 supplier settlement");
});

test("sub-rental settlement records owner payout as an idempotent expense and cash movement", { skip }, async () => {
  const session = await ownerA.from("cash_sessions").insert({
    id: uuid(), agency_id: fixture.agencyA, branch_id: fixture.branchA1,
    opening_balance: 1000, opened_by: fixture.userA.id, notes: marker,
  }).select("id").single();
  assert.ifError(session.error);

  const args = {
    p_agency_id: fixture.agencyA,
    p_contract_id: fixture.contractA,
    p_owner_amount: 600,
    p_paid_amount: 250,
    p_payment_method: "CASH",
    p_notes: `${marker} owner payout`,
  };
  const first = await ownerA.rpc("save_vehicle_owner_settlement", args);
  assert.ifError(first.error, "owner payout should commit with the settlement");
  assert.equal(first.data.status, "PARTIALLY_PAID");
  assert.equal(Number(first.data.paid_delta), 250);
  assert.ok(first.data.expense_id, "owner payout did not create an expense ledger entry");

  const settlement = await ownerA.from("vehicle_owner_settlements")
    .select("owner_amount,paid_amount,agency_margin,status,payment_method")
    .eq("contract_id", fixture.contractA).eq("vehicle_id", fixture.vehicleA1).single();
  assert.ifError(settlement.error);
  assert.equal(Number(settlement.data.owner_amount), 600);
  assert.equal(Number(settlement.data.paid_amount), 250);
  assert.equal(Number(settlement.data.agency_margin), 300);
  assert.equal(settlement.data.payment_method, "CASH");

  const expense = await ownerA.from("expenses").select("id,amount,payment_method,category,idempotency_key")
    .eq("id", first.data.expense_id).single();
  assert.ifError(expense.error);
  assert.equal(Number(expense.data.amount), 250);
  assert.equal(expense.data.payment_method, "CASH");
  assert.equal(expense.data.category, "SUBLEASE_OWNER_SETTLEMENT");

  const movement = await ownerA.from("cash_movements").select("id,amount,movement_type,reference_type,reference_id")
    .eq("reference_type", "EXPENSE").eq("reference_id", first.data.expense_id).single();
  assert.ifError(movement.error);
  assert.equal(Number(movement.data.amount), 250);
  assert.equal(movement.data.movement_type, "EXPENSE");

  const retry = await ownerA.rpc("save_vehicle_owner_settlement", args);
  assert.ifError(retry.error, "the same owner payout should be safely replayable");
  assert.equal(Number(retry.data.paid_delta), 0);
  assert.equal(retry.data.replayed, true);
  const expenses = await ownerA.from("expenses").select("id").eq("idempotency_key", expense.data.idempotency_key);
  assert.ifError(expenses.error);
  assert.equal(expenses.data.length, 1, "retry created a duplicate owner expense");
  const closed = await ownerA.from("cash_sessions").update({
    status: "CLOSED", expected_closing_balance: 750, actual_closing_balance: 750,
    difference: 0, closed_at: new Date().toISOString(), closed_by: fixture.userA.id,
  }).eq("id", session.data.id).eq("status", "OPEN");
  assert.ifError(closed.error);
});

test("cash source references are unique and a branch agent cannot see another branch session", { skip }, async () => {
  const sessionA1 = await ownerA.from("cash_sessions").insert({
    id: uuid(), agency_id: fixture.agencyA, branch_id: fixture.branchA1,
    opening_balance: 100, opened_by: fixture.userA.id, notes: marker,
  }).select("id").single();
  assert.ifError(sessionA1.error);
  const sessionA2 = await ownerA.from("cash_sessions").insert({
    id: uuid(), agency_id: fixture.agencyA, branch_id: fixture.branchA2,
    opening_balance: 100, opened_by: fixture.userA.id, notes: marker,
  }).select("id").single();
  assert.ifError(sessionA2.error);
  const hidden = await branchAgent.from("cash_sessions").select("id")
    .eq("id", sessionA2.data.id);
  assert.ifError(hidden.error);
  assert.equal(hidden.data.length, 0, "Branch A1 agent read Branch A2 cash session");

  const paymentReference = uuid();
  const movement = {
    agency_id: fixture.agencyA, branch_id: fixture.branchA1,
    session_id: sessionA1.data.id, movement_type: "PAYMENT", amount: 200,
    reference_type: "PAYMENT", reference_id: paymentReference,
    created_by: fixture.userA.id, reason: marker,
  };
  const first = await ownerA.from("cash_movements").insert({ id: uuid(), ...movement });
  assert.ifError(first.error);
  const retry = await ownerA.from("cash_movements").insert({ id: uuid(), ...movement });
  assert.ok(retry.error, "A repeated cash source reference created duplicate movement");
  const count = await ownerA.from("cash_movements").select("id")
    .eq("session_id", sessionA1.data.id).eq("reference_id", paymentReference);
  assert.ifError(count.error);
  assert.equal(count.data.length, 1, "Cash retry changed the session balance twice");
});

test("transfer actions use the seeded vehicle update permission", { skip }, async () => {
  const ownerRole = await admin.from("roles").select("id").eq("key", "AGENCY_OWNER").single();
  assert.ifError(ownerRole.error);
  const links = await admin.from("role_permissions").select("permission_id").eq("role_id", ownerRole.data.id);
  assert.ifError(links.error);
  const permissionIds = links.data.map((row) => row.permission_id).filter(Boolean);
  const permissions = await admin.from("permissions").select("key").in("id", permissionIds);
  assert.ifError(permissions.error);
  assert.ok(permissions.data.some((row) => row.key === "vehicles.update"),
    "The transfer server actions must be backed by the seeded vehicles.update permission");
});

async function cleanup() {
  if (!admin || !migrationReady) return;
  const cleanupErrors = [];
  const recordError = (error, subject) => {
    if (error) cleanupErrors.push(`${subject}: ${error.message}`);
  };
  const childTables = [
    "cash_movements", "cash_sessions", "vehicle_owner_settlements", "rental_participants",
    "contract_signatures", "contract_checkins", "contract_checkouts", "damage_records",
    "audit_logs", "invoices", "payments", "expenses", "contracts", "reservations",
    "vehicle_blocks", "customers", "vehicles",
  ];
  for (const table of childTables) {
    for (const agencyId of created.agencies) {
      const result = await admin.from(table).delete().eq("agency_id", agencyId);
      recordError(result.error, `${marker} ${table} ${agencyId}`);
    }
  }
  for (const agencyId of created.agencies) {
    for (const table of ["agency_members", "agency_settings", "subscriptions"]) {
      const result = await admin.from(table).delete().eq("agency_id", agencyId);
      recordError(result.error, `${marker} ${table} ${agencyId}`);
    }
    const branches = await admin.from("branches").delete().eq("agency_id", agencyId);
    recordError(branches.error, `${marker} branches ${agencyId}`);
    const agency = await admin.from("agencies").delete().eq("id", agencyId);
    recordError(agency.error, `${marker} agency ${agencyId}`);
  }
  for (const user of created.users) {
    const profile = await admin.from("profiles").delete().eq("id", user.id);
    recordError(profile.error, `${marker} profile ${user.id}`);
    const result = await admin.auth.admin.deleteUser(user.id);
    recordError(result.error, `${marker} auth user ${user.id}`);
  }
  for (const agencyId of created.agencies) {
    const agency = await admin.from("agencies").select("id").eq("id", agencyId).maybeSingle();
    recordError(agency.error, `${marker} agency cleanup verification ${agencyId}`);
    if (agency.data) cleanupErrors.push(`${marker} agency ${agencyId} still exists`);
    for (const table of ["rental_participants", "vehicle_owner_settlements", "reservations", "contracts", "cash_movements"]) {
      const result = await admin.from(table).select("id").eq("agency_id", agencyId).limit(1);
      recordError(result.error, `${marker} ${table} cleanup verification ${agencyId}`);
      if (result.data?.length) cleanupErrors.push(`${marker} ${table} rows remain for ${agencyId}`);
    }
  }
  assert.equal(cleanupErrors.length, 0, `Synthetic test cleanup failed: ${cleanupErrors.join("; ")}`);
}

after(cleanup, { skip });
