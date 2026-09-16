import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(file = ".env.test.local") {
  const result = {};
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !match[2].startsWith("#")) result[match[1]] = match[2].trim();
    }
  } catch {
    // CI can provide all values through process.env instead.
  }
  return result;
}

const fileEnv = readEnvFile();
const env = (key) => process.env[key] || fileEnv[key] || "";
const required = ["FLEETHUB_TEST_SUPABASE_URL", "FLEETHUB_TEST_SUPABASE_ANON_KEY", "FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY"];
const configured = required.every((key) => env(key));
const skip = configured ? false : "Staging Supabase credentials are required; security tests fail closed instead of reading production .env.local.";
if (configured) {
  const stagingUrl = env("FLEETHUB_TEST_SUPABASE_URL");
  const host = new URL(stagingUrl).hostname;
  assert.ok(!host.includes("wewajfotwphufsthfgul"), "security tests must never target production");
  assert.ok(host.includes("nyurwczpxpcpwqamfoek"), "security tests must target the configured FleetHub staging project");
}

let admin;
let serviceAdmin;
let authClient;
let agencyB;
let clientA;
let clientB;
let clientBranch;
const createdUsers = [];
const createdAgencies = [];
const fixture = {};

function id() {
  return crypto.randomUUID();
}

async function insert(table, payload) {
  const { data, error } = await admin.from(table).insert(payload).select("id").single();
  assert.ifError(error, `Fixture insert failed for ${table}`);
  assert.ok(data?.id, `Fixture ${table} did not return an id`);
  return data.id;
}

async function createFixtureUser(label) {
  const email = `fleethub-security-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.invalid`;
  const password = `Test!${crypto.randomBytes(18).toString("base64url")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `FleetHub Security ${label}` },
  });
  assert.ifError(error, `Auth fixture ${label} could not be created`);
  assert.ok(data.user?.id, `Auth fixture ${label} did not return a user`);
  const user = { id: data.user.id, email, password };
  createdUsers.push(user);
  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id, email, full_name: `FleetHub Security ${label}`, is_super_admin: false,
  });
  assert.ifError(profileError, `Profile fixture ${label} could not be created`);
  return user;
}

async function createFixtureAgency(label, ownerId, roleId) {
  const agencyId = id();
  const { error } = await admin.from("agencies").insert({
    id: agencyId,
    name: `FleetHub Security ${label}`,
    slug: `fleethub-security-${label.toLowerCase()}-${agencyId.slice(0, 8)}`,
    status: "ACTIVE",
    currency: "MAD",
    timezone: "Africa/Casablanca",
    created_by: ownerId,
  });
  assert.ifError(error, `Agency fixture ${label} could not be created`);
  createdAgencies.push(agencyId);
  const { error: memberError } = await admin.from("agency_members").insert({
    agency_id: agencyId,
    profile_id: ownerId,
    role_id: roleId,
    status: "active",
    joined_at: new Date().toISOString(),
  });
  assert.ifError(memberError, `Agency membership fixture ${label} could not be created`);
  return agencyId;
}

async function seedFixtures() {
  admin = createClient(env("FLEETHUB_TEST_SUPABASE_URL"), env("FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Keep a service-key client separate from the fixture sign-in client. The
  // latter receives a user session during setup and would no longer be able to
  // call the guarded synthetic teardown RPC.
  serviceAdmin = createClient(env("FLEETHUB_TEST_SUPABASE_URL"), env("FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Keep the service-role clients sessionless. Signing in on a service-role
  // client mutates its Authorization header and makes later fixture cleanup
  // or admin assertions unexpectedly subject to end-user RLS.
  authClient = createClient(env("FLEETHUB_TEST_SUPABASE_URL"), env("FLEETHUB_TEST_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: role, error: roleError } = await admin.from("roles").select("id").eq("key", "AGENCY_OWNER").single();
  assert.ifError(roleError, "AGENCY_OWNER role fixture is missing");

  const userA = await createFixtureUser("A");
  const userB = await createFixtureUser("B");
  await createFixtureAgency("A", userA.id, role.id);
  agencyB = await createFixtureAgency("B", userB.id, role.id);
  fixture.userA = userA;
  fixture.userB = userB;

  fixture.branchAllowed = id();
  const { error: mainBranchError } = await admin.from("branches").insert({
    id: fixture.branchAllowed, agency_id: agencyB, name: "Main Fixture", code: "MAIN", city: "Casablanca", active: true,
  });
  assert.ifError(mainBranchError, "Default branch fixture could not be created");
  fixture.branchDenied = id();
  const { error: branchError } = await admin.from("branches").insert({
    id: fixture.branchDenied, agency_id: agencyB, name: "Branch Fixture", code: `T${Date.now().toString().slice(-5)}`,
    city: "Casablanca", active: true,
  });
  assert.ifError(branchError, "Branch fixture could not be created");
  const { data: agentRole, error: agentRoleError } = await admin.from("roles").select("id").eq("key", "AGENT").single();
  assert.ifError(agentRoleError, "AGENT role fixture is missing");
  const branchUser = await createFixtureUser("BRANCH");
  fixture.branchUser = branchUser;
  const { error: branchMemberError } = await admin.from("agency_members").insert({
    agency_id: agencyB, profile_id: branchUser.id, role_id: agentRole.id, branch_id: fixture.branchAllowed,
    status: "active", joined_at: new Date().toISOString(),
  });
  assert.ifError(branchMemberError, "Branch membership fixture could not be created");

  fixture.customer = await insert("customers", {
    id: id(), agency_id: agencyB, first_name: "Tenant", last_name: "B", id_type: "CIN", notes: "Fixture",
  });
  fixture.vehicle = await insert("vehicles", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, brand: "Dacia", model: "Logan", year: 2024,
    license_plate: `SEC-${Date.now().toString().slice(-6)}`, status: "AVAILABLE",
  });
  fixture.branchVehicle = await insert("vehicles", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchDenied, brand: "Dacia", model: "Branch Fixture", year: 2024,
    license_plate: `BR-${Date.now().toString().slice(-6)}`, status: "AVAILABLE",
  });
  fixture.reservation = await insert("reservations", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, customer_id: fixture.customer, vehicle_id: fixture.vehicle,
    reference: `SEC-RES-${Date.now()}`, start_date: "2099-01-01", end_date: "2099-01-04",
    status: "CANCELLED", daily_rate: 300, total_days: 3, total_amount: 900,
  });
  fixture.contract = await insert("contracts", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, customer_id: fixture.customer, vehicle_id: fixture.vehicle,
    reservation_id: fixture.reservation, contract_number: `SEC-CON-${Date.now()}`,
    start_date: "2099-01-01", end_date: "2099-01-04", status: "CLOSED", daily_rate: 300,
    deposit_amount: 1000, total_amount: 900,
  });
  fixture.payment = await insert("payments", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, customer_id: fixture.customer, reservation_id: fixture.reservation,
    contract_id: fixture.contract, amount: 300, method: "CASH", type: "RENTAL", status: "COMPLETED",
    reference: `SEC-PAY-${Date.now()}`,
  });
  fixture.maintenance = await insert("maintenance_records", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, vehicle_id: fixture.vehicle, type: "OTHER", status: "COMPLETED", cost: 50,
    description: "Fixture", service_date: "2099-01-01",
  });
  fixture.expense = await insert("expenses", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, vehicle_id: fixture.vehicle, category: "OTHER", amount: 25,
    description: "Fixture", payment_method: "CASH", expense_date: "2099-01-01",
  });
  fixture.invoice = await insert("invoices", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, contract_id: fixture.contract, invoice_number: `SEC-INV-${Date.now()}`,
    kind: "RECEIPT", status: "DRAFT", seller_name: "Fixture Agency", buyer_name: "Tenant B",
    currency: "MAD", subtotal: 900, total_amount: 900, snapshot: {},
  });
  fixture.lead = await insert("leads", {
    id: id(), agency_id: agencyB, first_name: "Lead", last_name: "B", source: "PHONE", status: "NEW",
    created_by: fixture.userB.id,
  });
  fixture.audit = await insert("audit_logs", {
    id: id(), agency_id: agencyB, actor_id: fixture.userB.id, action: "SECURITY_FIXTURE",
    entity_type: "fixture", entity_id: fixture.customer, metadata: { fixture: true },
  });

  fixture.document = id();
  fixture.documentPath = `${agencyB}/${fixture.customer}/${fixture.document}.pdf`;
  const { error: storageError } = await admin.storage.from("customer-documents").upload(
    fixture.documentPath,
    new Uint8Array([37, 80, 68, 70]),
    { contentType: "application/pdf", upsert: false },
  );
  assert.ifError(storageError, "Document fixture upload failed");
  fixture.documentRow = await insert("customer_documents", {
    id: fixture.document, agency_id: agencyB, customer_id: fixture.customer,
    document_type: "OTHER", storage_path: fixture.documentPath, file_name: "fixture.pdf",
    content_type: "application/pdf", size_bytes: 4, created_by: fixture.userB.id,
  });
  fixture.vehicleDocument = id();
  fixture.vehicleDocumentPath = `${agencyB}/${fixture.vehicle}/${fixture.vehicleDocument}.pdf`;
  const { error: vehicleStorageError } = await admin.storage.from("vehicle-documents").upload(
    fixture.vehicleDocumentPath,
    new Uint8Array([37, 80, 68, 70]),
    { contentType: "application/pdf", upsert: false },
  );
  assert.ifError(vehicleStorageError, "Vehicle document fixture upload failed");
  await insert("vehicle_documents", {
    id: fixture.vehicleDocument, agency_id: agencyB, vehicle_id: fixture.vehicle,
    document_type: "INSURANCE", document_number: "SEC-POLICY", storage_path: fixture.vehicleDocumentPath,
    file_name: "insurance.pdf", content_type: "application/pdf", size_bytes: 4, created_by: fixture.userB.id,
  });
  fixture.pricing = await insert("pricing_rules", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, name: "Security pricing", daily_rate: 300, weekly_rate: 1800,
    monthly_rate: 6000, minimum_daily_rate: 250, active: true, created_by: fixture.userB.id,
  });
  fixture.promotion = await insert("promotions", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, code: `SEC-${Date.now()}`, name: "Security promotion",
    discount_type: "PERCENT", discount_value: 10, minimum_days: 1, valid_from: "2099-01-01", valid_to: "2099-12-31", created_by: fixture.userB.id,
  });
  fixture.extra = await insert("extras_catalog", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, code: `GPS-${Date.now()}`, name: "GPS fixture",
    pricing_type: "PER_DAY", price: 25, created_by: fixture.userB.id,
  });
  fixture.reservationExtra = await insert("reservation_extras", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, reservation_id: fixture.reservation,
    extra_id: fixture.extra, code: "GPS", name: "GPS fixture", pricing_type: "PER_DAY", quantity: 1,
    unit_price: 25, total_amount: 75, created_by: fixture.userB.id,
  });
  fixture.contractExtra = await insert("contract_extras", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, contract_id: fixture.contract,
    extra_id: fixture.extra, code: "GPS", name: "GPS fixture", pricing_type: "PER_DAY", quantity: 1,
    unit_price: 25, total_amount: 75, created_by: fixture.userB.id,
  });
  fixture.pricingOverride = await insert("pricing_override_history", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, reservation_id: fixture.reservation,
    actor_id: fixture.userB.id, original_daily_rate: 300, requested_daily_rate: 250, minimum_daily_rate: 275,
    discount_amount: 0, reason: "Security fixture override",
  });
  fixture.preparation = await insert("vehicle_preparations", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, vehicle_id: fixture.vehicle,
    reservation_id: fixture.reservation, contract_id: fixture.contract, status: "IN_PROGRESS", prepared_by: fixture.userB.id,
  });
  fixture.checkout = await insert("contract_checkouts", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, vehicle_id: fixture.vehicle,
    reservation_id: fixture.reservation, contract_id: fixture.contract, mileage: 1000, fuel_level: 8,
    cleanliness: "CLEAN", keys_count: 1, signature_name: "Fixture Customer", created_by: fixture.userB.id,
  });
  fixture.rentalUpdate = await insert("active_rental_updates", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, vehicle_id: fixture.vehicle,
    contract_id: fixture.contract, event_type: "OTHER", notes: "Security rental event", created_by: fixture.userB.id,
  });
  fixture.extension = await insert("rental_extensions", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, contract_id: fixture.contract,
    previous_end_date: "2099-01-04", new_end_date: "2099-01-05", added_days: 1, daily_rate: 300,
    extra_amount: 300, reason: "Security extension", created_by: fixture.userB.id, approved_by: fixture.userB.id,
  });
  fixture.swapVehicle = await insert("vehicles", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, brand: "Dacia", model: "Swap Fixture", year: 2024,
    license_plate: `SW-${Date.now().toString().slice(-6)}`, status: "AVAILABLE",
  });
  fixture.swap = await insert("vehicle_swaps", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, contract_id: fixture.contract,
    old_vehicle_id: fixture.vehicle, new_vehicle_id: fixture.swapVehicle, reason: "Security swap", created_by: fixture.userB.id,
  });
  fixture.checkin = await insert("contract_checkins", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, contract_id: fixture.contract, vehicle_id: fixture.vehicle,
    reservation_id: fixture.reservation, return_mileage: 1100, fuel_level: 7, cleanliness: "ACCEPTABLE", signature_name: "Fixture Return", status: "REVIEW", returned_by: fixture.userB.id,
  });
  fixture.returnCharge = await insert("return_charges", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, contract_id: fixture.contract, checkin_id: fixture.checkin,
    charge_type: "OTHER", quantity: 1, unit_price: 10, amount: 10, reason: "Fixture charge", created_by: fixture.userB.id,
  });
  fixture.damage = await insert("damage_records", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, vehicle_id: fixture.vehicle, customer_id: fixture.customer, contract_id: fixture.contract,
    body_area: "door", damage_type: "scratch", description: "Fixture damage", created_by: fixture.userB.id,
  });
  fixture.accident = await insert("accidents", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, vehicle_id: fixture.vehicle, customer_id: fixture.customer, contract_id: fixture.contract,
    occurred_at: "2099-01-02T10:00:00Z", location: "Casablanca", description: "Fixture accident", created_by: fixture.userB.id,
  });
  fixture.accidentPhoto = id();
  fixture.accidentPhotoPath = `${agencyB}/${fixture.accident}/${fixture.accidentPhoto}.jpg`;
  const { error: accidentStorageError } = await admin.storage.from("accident-photos").upload(
    fixture.accidentPhotoPath,
    new Uint8Array([255, 216, 255, 217]),
    { contentType: "image/jpeg", upsert: false },
  );
  assert.ifError(accidentStorageError, "Accident photo fixture upload failed");
  await insert("accident_photos", {
    id: fixture.accidentPhoto, agency_id: agencyB, branch_id: fixture.branchAllowed, accident_id: fixture.accident,
    media_type: "PHOTO", storage_path: fixture.accidentPhotoPath, file_name: "fixture.jpg", content_type: "image/jpeg",
    size_bytes: 4, created_by: fixture.userB.id,
  });
  fixture.fine = await insert("fines", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, vehicle_id: fixture.vehicle, contract_id: fixture.contract, customer_id: fixture.customer,
    violation_at: "2099-01-02T10:00:00Z", amount: 100, reference: `F-${Date.now()}`, created_by: fixture.userB.id,
  });
  fixture.deposit = await insert("deposits", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, contract_id: fixture.contract, required_amount: 1000, received_amount: 0, held_amount: 0, status: "REQUIRED",
  });
  fixture.depositTx = await insert("deposit_transactions", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, deposit_id: fixture.deposit, transaction_type: "RECEIVED", amount: 1000, created_by: fixture.userB.id, idempotency_key: `SEC-DEP-${Date.now()}`,
  });
  fixture.cashSession = await insert("cash_sessions", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, opening_balance: 100, opened_by: fixture.userB.id,
  });
  fixture.cashMovement = await insert("cash_movements", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, session_id: fixture.cashSession, movement_type: "PAYMENT", amount: 50, created_by: fixture.userB.id,
  });
  fixture.mission = await insert("delivery_missions", {
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, vehicle_id: fixture.vehicle, customer_id: fixture.customer, contract_id: fixture.contract,
    mission_type: "DELIVERY", scheduled_at: "2099-01-01T10:00:00Z", created_by: fixture.userB.id,
  });
  fixture.transfer = await insert("vehicle_transfers", {
    id: id(), agency_id: agencyB, vehicle_id: fixture.vehicle, from_branch_id: fixture.branchAllowed, to_branch_id: fixture.branchDenied,
    planned_departure: "2099-01-01T10:00:00Z", status: "PLANNED", created_by: fixture.userB.id,
  });

  const [a, b, c] = await Promise.all([
    authClient.auth.signInWithPassword({ email: userA.email, password: userA.password }),
    authClient.auth.signInWithPassword({ email: userB.email, password: userB.password }),
    authClient.auth.signInWithPassword({ email: branchUser.email, password: branchUser.password }),
  ]);
  assert.ifError(a.error, "Agency A fixture sign-in failed");
  assert.ifError(b.error, "Agency B fixture sign-in failed");
  assert.ifError(c.error, "Branch fixture sign-in failed");
  clientA = createClient(env("FLEETHUB_TEST_SUPABASE_URL"), env("FLEETHUB_TEST_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${a.data.session.access_token}` } },
  });
  clientB = createClient(env("FLEETHUB_TEST_SUPABASE_URL"), env("FLEETHUB_TEST_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${b.data.session.access_token}` } },
  });
  clientBranch = createClient(env("FLEETHUB_TEST_SUPABASE_URL"), env("FLEETHUB_TEST_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${c.data.session.access_token}` } },
  });
}

const tableRows = {
  customers: "customer",
  vehicles: "vehicle",
  reservations: "reservation",
  contracts: "contract",
  payments: "payment",
  maintenance_records: "maintenance",
  expenses: "expense",
  invoices: "invoice",
  customer_documents: "documentRow",
  vehicle_documents: "vehicleDocument",
  pricing_rules: "pricing",
  promotions: "promotion",
  extras_catalog: "extra",
  reservation_extras: "reservationExtra",
  contract_extras: "contractExtra",
  pricing_override_history: "pricingOverride",
  vehicle_preparations: "preparation",
  contract_checkouts: "checkout",
  active_rental_updates: "rentalUpdate",
  rental_extensions: "extension",
  vehicle_swaps: "swap",
  contract_checkins: "checkin",
  return_charges: "returnCharge",
  damage_records: "damage",
  accidents: "accident",
  accident_photos: "accidentPhoto",
  fines: "fine",
  deposits: "deposit",
  deposit_transactions: "depositTx",
  cash_sessions: "cashSession",
  cash_movements: "cashMovement",
  delivery_missions: "mission",
  leads: "lead",
  audit_logs: "audit",
};

const insertPayload = (table) => {
  const common = { id: id(), agency_id: agencyB };
  switch (table) {
    case "customers": return { ...common, first_name: "Injected", last_name: "Customer", id_type: "CIN" };
    case "vehicles": return { ...common, brand: "Injected", model: "Vehicle", year: 2024, license_plate: `INJ-${Date.now()}` };
    case "reservations": return { ...common, customer_id: fixture.customer, vehicle_id: fixture.vehicle, reference: `INJ-${Date.now()}`, start_date: "2099-02-01", end_date: "2099-02-03", status: "CANCELLED" };
    case "contracts": return { ...common, customer_id: fixture.customer, vehicle_id: fixture.vehicle, reservation_id: fixture.reservation, contract_number: `INJ-${Date.now()}`, start_date: "2099-02-01", end_date: "2099-02-03", status: "CLOSED" };
    case "payments": return { ...common, customer_id: fixture.customer, contract_id: fixture.contract, amount: 1, method: "CASH", type: "RENTAL", status: "COMPLETED" };
    case "maintenance_records": return { ...common, vehicle_id: fixture.vehicle, type: "OTHER", status: "COMPLETED" };
    case "expenses": return { ...common, vehicle_id: fixture.vehicle, category: "OTHER", amount: 1, payment_method: "CASH" };
    case "invoices": return { ...common, contract_id: fixture.contract, invoice_number: `INJ-${Date.now()}`, kind: "RECEIPT", status: "DRAFT", seller_name: "Injected", buyer_name: "Injected" };
    case "customer_documents": return { ...common, customer_id: fixture.customer, document_type: "OTHER", storage_path: `${agencyB}/${fixture.customer}/${common.id}.pdf`, file_name: "injected.pdf", content_type: "application/pdf", size_bytes: 4, created_by: fixture.userA.id };
    case "vehicle_documents": return { ...common, vehicle_id: fixture.vehicle, document_type: "OTHER", storage_path: `${agencyB}/${fixture.vehicle}/${common.id}.pdf`, file_name: "injected.pdf", content_type: "application/pdf", size_bytes: 4, created_by: fixture.userA.id };
    case "pricing_rules": return { ...common, name: "Injected pricing", daily_rate: 1, weekly_rate: 7, monthly_rate: 30, minimum_daily_rate: 1, created_by: fixture.userA.id };
    case "promotions": return { ...common, code: `INJ-${Date.now()}`, name: "Injected promotion", discount_type: "PERCENT", discount_value: 1, minimum_days: 1, valid_from: "2099-01-01", valid_to: "2099-12-31", created_by: fixture.userA.id };
    case "extras_catalog": return { ...common, branch_id: fixture.branchAllowed, code: `INJ-${Date.now()}`, name: "Injected extra", pricing_type: "FLAT", price: 1, created_by: fixture.userA.id };
    case "reservation_extras": return { ...common, branch_id: fixture.branchAllowed, reservation_id: fixture.reservation, extra_id: fixture.extra, code: "INJ", name: "Injected extra", pricing_type: "FLAT", quantity: 1, unit_price: 1, total_amount: 1, created_by: fixture.userA.id };
    case "contract_extras": return { ...common, branch_id: fixture.branchAllowed, contract_id: fixture.contract, extra_id: fixture.extra, code: "INJ", name: "Injected extra", pricing_type: "FLAT", quantity: 1, unit_price: 1, total_amount: 1, created_by: fixture.userA.id };
    case "pricing_override_history": return { ...common, branch_id: fixture.branchAllowed, reservation_id: fixture.reservation, actor_id: fixture.userA.id, original_daily_rate: 300, requested_daily_rate: 250, minimum_daily_rate: 275, reason: "Injected override" };
    case "vehicle_preparations": return { ...common, branch_id: fixture.branchAllowed, vehicle_id: fixture.vehicle, reservation_id: fixture.reservation, contract_id: fixture.contract, prepared_by: fixture.userA.id };
    case "contract_checkouts": return { ...common, branch_id: fixture.branchAllowed, vehicle_id: fixture.vehicle, reservation_id: fixture.reservation, contract_id: fixture.contract, mileage: 1000, fuel_level: 8, cleanliness: "CLEAN", keys_count: 1, signature_name: "Injected" };
    case "active_rental_updates": return { ...common, branch_id: fixture.branchAllowed, vehicle_id: fixture.vehicle, contract_id: fixture.contract, event_type: "OTHER", notes: "Injected event" };
    case "rental_extensions": return { ...common, branch_id: fixture.branchAllowed, contract_id: fixture.contract, previous_end_date: "2099-01-05", new_end_date: "2099-01-06", added_days: 1, daily_rate: 300, extra_amount: 300, reason: "Injected extension", created_by: fixture.userA.id };
    case "vehicle_swaps": return { ...common, branch_id: fixture.branchAllowed, contract_id: fixture.contract, old_vehicle_id: fixture.vehicle, new_vehicle_id: fixture.swapVehicle, reason: "Injected swap", created_by: fixture.userA.id };
    case "contract_checkins": return { ...common, branch_id: fixture.branchAllowed, contract_id: fixture.contract, vehicle_id: fixture.vehicle, return_mileage: 1200, fuel_level: 7, signature_name: "Injected Return" };
    case "return_charges": return { ...common, branch_id: fixture.branchAllowed, contract_id: fixture.contract, checkin_id: fixture.checkin, charge_type: "OTHER", quantity: 1, unit_price: 1, amount: 1, reason: "Injected" };
    case "damage_records": return { ...common, branch_id: fixture.branchAllowed, vehicle_id: fixture.vehicle, body_area: "hood", damage_type: "scratch", description: "Injected" };
    case "accidents": return { ...common, branch_id: fixture.branchAllowed, vehicle_id: fixture.vehicle, occurred_at: "2099-01-03T10:00:00Z", location: "Rabat", description: "Injected" };
    case "accident_photos": return { ...common, branch_id: fixture.branchAllowed, accident_id: fixture.accident, media_type: "PHOTO", storage_path: `${agencyB}/${fixture.accident}/${common.id}.jpg`, file_name: "injected.jpg", content_type: "image/jpeg", size_bytes: 4, created_by: fixture.userA.id };
    case "fines": return { ...common, branch_id: fixture.branchAllowed, vehicle_id: fixture.vehicle, violation_at: "2099-01-03T10:00:00Z", amount: 1 };
    case "deposits": return { ...common, branch_id: fixture.branchAllowed, contract_id: fixture.contract, required_amount: 1 };
    case "deposit_transactions": return { ...common, branch_id: fixture.branchAllowed, deposit_id: fixture.deposit, transaction_type: "RECEIVED", amount: 1, idempotency_key: `INJ-${Date.now()}` };
    case "cash_sessions": return { ...common, branch_id: fixture.branchAllowed, opening_balance: 1 };
    case "cash_movements": return { ...common, branch_id: fixture.branchAllowed, session_id: fixture.cashSession, movement_type: "PAYMENT", amount: 1 };
    case "delivery_missions": return { ...common, branch_id: fixture.branchAllowed, mission_type: "OTHER", scheduled_at: "2099-01-03T10:00:00Z" };
    case "vehicle_transfers": return { ...common, vehicle_id: fixture.vehicle, from_branch_id: fixture.branchAllowed, to_branch_id: fixture.branchDenied, planned_departure: "2099-01-03T10:00:00Z" };
    case "leads": return { ...common, first_name: "Injected", source: "PHONE", status: "NEW" };
    case "audit_logs": return { ...common, actor_id: fixture.userA.id, action: "INJECTED", entity_type: "fixture", metadata: {} };
    default: throw new Error(`Unknown fixture table ${table}`);
  }
};

const updatePayload = {
  customers: { notes: "cross-tenant-update" },
  vehicles: { color: "cross-tenant-update" },
  reservations: { notes: "cross-tenant-update" },
  contracts: { terms: "cross-tenant-update" },
  payments: { notes: "cross-tenant-update" },
  maintenance_records: { description: "cross-tenant-update" },
  expenses: { description: "cross-tenant-update" },
  invoices: { notes: "cross-tenant-update" },
  customer_documents: { file_name: "cross-tenant-update.pdf" },
  vehicle_documents: { file_name: "cross-tenant-update.pdf" },
  pricing_rules: { name: "cross-tenant-update" },
  promotions: { name: "cross-tenant-update" },
  extras_catalog: { name: "cross-tenant-update" },
  reservation_extras: { notes: "cross-tenant-update" },
  contract_extras: { notes: "cross-tenant-update" },
  pricing_override_history: { reason: "cross-tenant-update" },
  vehicle_preparations: { notes: "cross-tenant-update" },
  contract_checkouts: { notes: "cross-tenant-update" },
  active_rental_updates: { notes: "cross-tenant-update" },
  rental_extensions: { reason: "cross-tenant-update" },
  vehicle_swaps: { reason: "cross-tenant-update" },
  contract_checkins: { notes: "cross-tenant-update" },
  return_charges: { reason: "cross-tenant-update" },
  damage_records: { notes: "cross-tenant-update" },
  accidents: { notes: "cross-tenant-update" },
  accident_photos: { file_name: "cross-tenant-update.jpg" },
  fines: { notes: "cross-tenant-update" },
  deposits: { notes: "cross-tenant-update" },
  deposit_transactions: { reason: "cross-tenant-update" },
  cash_sessions: { notes: "cross-tenant-update" },
  cash_movements: { reason: "cross-tenant-update" },
  delivery_missions: { notes: "cross-tenant-update" },
  vehicle_transfers: { notes: "cross-tenant-update" },
  leads: { notes: "cross-tenant-update" },
  audit_logs: { metadata: { changed: true } },
};

async function assertForeignRowHidden(table, rowId) {
  const { data, error } = await clientA.from(table).select("id").eq("id", rowId);
  assert.ifError(error, `${table} cross-tenant select returned an error`);
  assert.equal(data?.length ?? 0, 0, `${table} leaked a row across agencies`);
}

async function assertForeignInsertBlocked(table) {
  const payload = insertPayload(table);
  const { data, error } = await clientA.from(table).insert(payload).select("id");
  assert.equal(data?.length ?? 0, 0, `${table} accepted a cross-tenant insert`);
  if (!error) {
    const { data: inserted, error: checkError } = await admin.from(table).select("id").eq("id", payload.id).maybeSingle();
    assert.ifError(checkError);
    assert.equal(inserted, null, `${table} inserted a cross-tenant row`);
  }
}

async function assertForeignMutationBlocked(table, rowId) {
  const { data: updateData } = await clientA.from(table).update(updatePayload[table]).eq("id", rowId).select("id");
  assert.equal(updateData?.length ?? 0, 0, `${table} accepted a cross-tenant update`);
  const { data: deleteData } = await clientA.from(table).delete().eq("id", rowId).select("id");
  assert.equal(deleteData?.length ?? 0, 0, `${table} accepted a cross-tenant delete`);
  const { data: stillThere, error } = await admin.from(table).select("id").eq("id", rowId).maybeSingle();
  assert.ifError(error);
  assert.ok(stillThere?.id, `${table} fixture disappeared after cross-tenant mutation attempts${error ? ` (${error.message})` : ""}`);
}

before(seedFixtures, { skip });

test("cross-tenant isolation blocks reads, writes, updates, deletes and private documents", { skip }, async () => {
  for (const [table, fixtureKey] of Object.entries(tableRows)) {
    await assertForeignRowHidden(table, fixture[fixtureKey]);
    await assertForeignInsertBlocked(table);
    await assertForeignMutationBlocked(table, fixture[fixtureKey]);
  }

  const { data: downloaded, error: downloadError } = await clientA.storage
    .from("customer-documents")
    .download(fixture.documentPath);
  assert.ok(downloadError || !downloaded, "Agency A downloaded Agency B's private document");
  const { data: listed, error: listError } = await clientA.storage
    .from("customer-documents")
    .list(agencyB);
  assert.ifError(listError);
  assert.equal(listed?.length ?? 0, 0, "Agency A listed Agency B's private documents");
  const { data: vehicleDownloaded, error: vehicleDownloadError } = await clientA.storage
    .from("vehicle-documents")
    .download(fixture.vehicleDocumentPath);
  assert.ok(vehicleDownloadError || !vehicleDownloaded, "Agency A downloaded Agency B's private vehicle document");

  const uploadedAccidentPath = `${agencyB}/${fixture.accident}/${id()}.jpg`;
  const { error: accidentUploadError } = await clientB.storage.from("accident-photos").upload(
    uploadedAccidentPath,
    new Uint8Array([255, 216, 255, 217]),
    { contentType: "image/jpeg", upsert: false },
  );
  assert.ifError(accidentUploadError, "Agency B could not upload an accident photo through Storage RLS");
  const { data: uploadedAccidentPhoto, error: uploadedAccidentMetadataError } = await clientB
    .from("accident_photos")
    .insert({
      id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, accident_id: fixture.accident,
      media_type: "PHOTO", storage_path: uploadedAccidentPath, file_name: "retry.jpg", content_type: "image/jpeg", size_bytes: 4,
    })
    .select("id")
    .single();
  assert.ifError(uploadedAccidentMetadataError, "Agency B could not save accident photo metadata");
  const { data: foreignAccidentPhoto, error: foreignAccidentPhotoError } = await clientA
    .storage.from("accident-photos").download(uploadedAccidentPath);
  assert.ok(foreignAccidentPhotoError || !foreignAccidentPhoto, "Agency A downloaded Agency B's accident photo");
  await admin.storage.from("accident-photos").remove([uploadedAccidentPath]);
  if (uploadedAccidentPhoto?.id) await admin.from("accident_photos").delete().eq("id", uploadedAccidentPhoto.id);
});

test("extras snapshot prices, recalculate totals and reject duplicate assignments", { skip }, async () => {
  const { data: reservation, error: reservationError } = await clientB
    .from("reservations").select("base_total_amount, extras_total, total_amount").eq("id", fixture.reservation).single();
  assert.ifError(reservationError);
  assert.equal(Number(reservation.extras_total), 75);
  assert.equal(Number(reservation.total_amount), Number(reservation.base_total_amount) + 75);
  const duplicate = await clientB.from("reservation_extras").insert({
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, reservation_id: fixture.reservation,
    extra_id: fixture.extra, code: "GPS", name: "GPS fixture", pricing_type: "PER_DAY", quantity: 1,
    unit_price: 25, total_amount: 75,
  });
  assert.ok(duplicate.error, "the same extra was assigned twice to one reservation");
  const { data: contract, error: contractError } = await clientB
    .from("contracts").select("base_total_amount, extras_total, total_amount").eq("id", fixture.contract).single();
  assert.ifError(contractError);
  assert.equal(Number(contract.extras_total), 75);
  assert.equal(Number(contract.total_amount), Number(contract.base_total_amount) + 75);
});

test("branch-limited members cannot read or write another branch", { skip }, async () => {
  const { data: allowed, error: allowedError } = await clientBranch.from("vehicles").select("id").eq("id", fixture.vehicle);
  assert.ifError(allowedError);
  assert.equal(allowed?.length ?? 0, 1, "Branch member could not read the assigned branch");

  const { data: denied, error: deniedError } = await clientBranch.from("vehicles").select("id").eq("id", fixture.branchVehicle);
  assert.ifError(deniedError);
  assert.equal(denied?.length ?? 0, 0, "Branch member read a vehicle from another branch");

  const inserted = await clientBranch.from("vehicles").insert({
    id: id(), agency_id: agencyB, branch_id: fixture.branchDenied, brand: "Injected", model: "Vehicle", year: 2024,
    license_plate: `BR-INJ-${Date.now()}`, status: "AVAILABLE",
  }).select("id");
  assert.equal(inserted.data?.length ?? 0, 0, "Branch member inserted into another branch");
});

test("database availability guards block reservations and blocks in both directions", { skip }, async () => {
  const blockId = id();
  const { error: blockError } = await admin.from("vehicle_blocks").insert({
    id: blockId, agency_id: agencyB, vehicle_id: fixture.vehicle, branch_id: fixture.branchAllowed,
    block_type: "MAINTENANCE", reason: "Availability fixture", start_date: "2099-03-01", end_date: "2099-03-05",
  });
  assert.ifError(blockError);
  const blockedReservation = await clientB.from("reservations").insert({
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, customer_id: fixture.customer, vehicle_id: fixture.vehicle,
    reference: `BLOCKED-${id()}`, start_date: "2099-03-02", end_date: "2099-03-04", status: "CONFIRMED", daily_rate: 100,
    total_days: 2, total_amount: 200,
  });
  assert.ok(blockedReservation.error, "A reservation was created during a vehicle block");
  await admin.from("vehicle_blocks").delete().eq("id", blockId);

  const activeReservationId = id();
  const activeReservation = await clientB.from("reservations").insert({
    id: activeReservationId, agency_id: agencyB, branch_id: fixture.branchAllowed, customer_id: fixture.customer, vehicle_id: fixture.vehicle,
    reference: `ACTIVE-${id()}`, start_date: "2099-04-01", end_date: "2099-04-05", status: "CONFIRMED", daily_rate: 100,
    total_days: 4, total_amount: 400,
  });
  assert.ifError(activeReservation.error);
  const blockedByReservation = await clientB.from("vehicle_blocks").insert({
    id: id(), agency_id: agencyB, vehicle_id: fixture.vehicle, branch_id: fixture.branchAllowed,
    block_type: "DAMAGE", reason: "Availability fixture", start_date: "2099-04-02", end_date: "2099-04-03",
  });
  assert.ok(blockedByReservation.error, "A block was created over an active reservation");
  await admin.from("reservations").delete().eq("id", activeReservationId);
});

test("contract signatures are tenant-private and append-only", { skip }, async () => {
  const signatureId = id();
  const created = await clientB.from("contract_signatures").insert({
    id: signatureId,
    agency_id: agencyB,
    branch_id: fixture.branchAllowed,
    contract_id: fixture.contract,
    signer_type: "CUSTOMER",
    signer_id: fixture.userB.id,
    signer_name: "Fixture Customer",
    signature_data: `data:image/png;base64,${"A".repeat(120)}`,
    contract_version: 1,
  }).select("id").single();
  assert.ifError(created.error, "agency B could not save a contract signature");

  const hidden = await clientA.from("contract_signatures").select("id").eq("id", signatureId).maybeSingle();
  assert.ifError(hidden.error);
  assert.equal(hidden.data, null, "agency A can read agency B signature");

  const updated = await clientB.from("contract_signatures").update({ signer_name: "Tampered" }).eq("id", signatureId);
  assert.ok(updated.error, "a signature record was mutable");
  const deleted = await clientB.from("contract_signatures").delete().eq("id", signatureId);
  assert.ok(deleted.error, "a signature record was deletable");
  await admin.from("contract_signatures").delete().eq("id", signatureId);
});

test("active transfers block bookings and completion moves the vehicle", { skip }, async () => {
  const transferId = id();
  const { error: created } = await clientB.from("vehicle_transfers").insert({
    id: transferId, agency_id: agencyB, vehicle_id: fixture.vehicle, from_branch_id: fixture.branchAllowed,
    to_branch_id: fixture.branchDenied, planned_departure: "2099-05-01T10:00:00Z", mileage_departure: 1100,
    fuel_departure: 8, status: "IN_TRANSIT",
  });
  assert.ifError(created);
  const { data: blockedVehicle } = await clientB.from("vehicles").select("status").eq("id", fixture.vehicle).single();
  assert.equal(blockedVehicle?.status, "OUT_OF_SERVICE");
  const blockedBooking = await clientB.from("reservations").insert({
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, customer_id: fixture.customer, vehicle_id: fixture.vehicle,
    reference: `TRANSFER-BLOCK-${id()}`, start_date: "2099-05-02", end_date: "2099-05-03", status: "CONFIRMED", daily_rate: 100, total_days: 1, total_amount: 100,
  });
  assert.ok(blockedBooking.error, "booking was accepted while vehicle was in transfer");
  const { error: completed } = await clientB.from("vehicle_transfers").update({ status: "COMPLETED", arrival_at: new Date().toISOString(), mileage_arrival: 1120, fuel_arrival: 7 }).eq("id", transferId).eq("status", "IN_TRANSIT");
  assert.ifError(completed);
  const { data: moved } = await clientB.from("vehicles").select("branch_id,status,mileage").eq("id", fixture.vehicle).single();
  assert.equal(moved?.branch_id, fixture.branchDenied);
  assert.equal(Number(moved?.mileage), 1120);
  await admin.from("vehicles").update({ branch_id: fixture.branchAllowed, status: "AVAILABLE", mileage: 1000 }).eq("id", fixture.vehicle);
  await admin.from("vehicle_transfers").delete().eq("id", transferId);
});

test("return integrity, damage availability and deposit safeguards", { skip }, async () => {
  const duplicate = await clientB.from("contract_checkins").insert({
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, contract_id: fixture.contract, vehicle_id: fixture.vehicle,
    return_mileage: 1100, fuel_level: 7, cleanliness: "CLEAN", signature_name: "Duplicate",
  });
  assert.ok(duplicate.error, "a second check-in was accepted");
  const lowerContract = id();
  const { error: lowerContractError } = await admin.from("contracts").insert({
    id: lowerContract, agency_id: agencyB, branch_id: fixture.branchAllowed, customer_id: fixture.customer, vehicle_id: fixture.swapVehicle,
    contract_number: `LOW-${Date.now()}`, start_date: "2099-06-01", end_date: "2099-06-02", status: "ACTIVE", daily_rate: 100,
    deposit_amount: 0, total_amount: 100, start_mileage: 1000,
  });
  assert.ifError(lowerContractError);
  const lower = await clientB.from("contract_checkins").insert({
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, contract_id: lowerContract, vehicle_id: fixture.swapVehicle,
    return_mileage: 1, fuel_level: 7, cleanliness: "CLEAN", signature_name: "Lower",
  });
  assert.ok(lower.error, "invalid check-in mileage was accepted");
  await admin.from("contracts").delete().eq("id", lowerContract);
  const overRefund = await clientB.from("deposit_transactions").insert({
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, deposit_id: fixture.deposit, transaction_type: "REFUND", amount: 1001,
    reason: "over refund", idempotency_key: `OVER-${id()}`,
  });
  assert.ok(overRefund.error, "deposit refund exceeded held balance");
  const overReceive = await admin.from("deposit_transactions").insert({
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, deposit_id: fixture.deposit, transaction_type: "RECEIVED", amount: 1,
    reason: "over receive", idempotency_key: `OVER-RECEIVE-${id()}`,
  });
  assert.ok(overReceive.error, "deposit received amount exceeded required amount");
  const deductionKey = `SEC-DEDUCTION-${id()}`;
  const { error: deductionError } = await clientB.from("deposit_transactions").insert({
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, deposit_id: fixture.deposit,
    transaction_type: "DEDUCTION", amount: 400, reason: "security settlement", settles_balance: true,
    idempotency_key: deductionKey,
  });
  assert.ifError(deductionError, "deposit deduction could not be recorded");
  const { error: refundError } = await clientB.from("deposit_transactions").insert({
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, deposit_id: fixture.deposit,
    transaction_type: "REFUND", amount: 600, reason: "security remainder", idempotency_key: `SEC-REFUND-${id()}`,
  });
  assert.ifError(refundError, "deposit partial refund could not be recorded");
  const { data: depositState } = await clientB.from("deposits").select("deducted_amount,refunded_amount,status").eq("id", fixture.deposit).single();
  assert.equal(Number(depositState?.deducted_amount), 400);
  assert.equal(Number(depositState?.refunded_amount), 600);
  assert.equal(depositState?.status, "REFUNDED");
  const duplicateDepositRefund = await clientB.from("deposit_transactions").insert({
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, deposit_id: fixture.deposit,
    transaction_type: "REFUND", amount: 1, reason: "duplicate security refund", idempotency_key: `SEC-REFUND-DUP-${id()}`,
  });
  assert.ok(duplicateDepositRefund.error, "deposit refund exceeded available balance after settlement");
  const { error: damageError } = await clientB.from("damage_records").insert({
    id: id(), agency_id: agencyB, branch_id: fixture.branchAllowed, vehicle_id: fixture.vehicle, body_area: "front", damage_type: "impact", severity: "CRITICAL", description: "Critical fixture damage",
  });
  assert.ifError(damageError);
  const { data: damaged } = await clientB.from("vehicles").select("status").eq("id", fixture.vehicle).single();
  assert.equal(damaged?.status, "OUT_OF_SERVICE");
  const { data: historical } = await clientB.from("contracts").select("id,customer_id").eq("agency_id", agencyB).eq("vehicle_id", fixture.vehicle).lte("start_date", "2099-01-02T10:00:00Z").gte("end_date", "2099-01-02T10:00:00Z").in("status", ["ACTIVE", "CLOSED"]);
  assert.equal(historical?.length, 1, "historical contract lookup was not unique");
  await admin.from("vehicles").update({ status: "AVAILABLE" }).eq("id", fixture.vehicle);
});

test("financial writes are idempotent and refunds serialize", { skip }, async () => {
  const paymentKey = `security-payment-${id()}`;
  const paymentPayload = {
    id: id(), agency_id: agencyB, customer_id: fixture.customer, contract_id: fixture.contract,
    amount: 125, method: "CASH", type: "RENTAL", status: "COMPLETED", idempotency_key: paymentKey,
  };
  const paymentPayloadRetry = { ...paymentPayload, id: id() };
  const [paymentA, paymentB] = await Promise.all([
    clientB.from("payments").insert(paymentPayload).select("id"),
    clientB.from("payments").insert(paymentPayloadRetry).select("id"),
  ]);
  assert.equal([paymentA, paymentB].filter((result) => !result.error).length, 1, `duplicate payment request was accepted twice (${paymentA.error?.message ?? "ok"}; ${paymentB.error?.message ?? "ok"})`);
  const successfulPayments = [paymentA, paymentB].filter((result) => !result.error);
  assert.equal(successfulPayments.length, 1, "idempotency key accepted more than one payment");
  assert.ok(successfulPayments[0].data?.[0]?.id, "the accepted idempotent payment was not persisted");

  const refundPayload = {
    id: id(), agency_id: agencyB, customer_id: fixture.customer, contract_id: fixture.contract,
    amount: 425, method: "CASH", type: "REFUND", status: "COMPLETED", idempotency_key: `security-refund-${id()}`,
  };
  const refundRetry = { ...refundPayload, id: id(), idempotency_key: `security-refund-${id()}` };
  const [refundA, refundB] = await Promise.all([
    clientB.from("payments").insert(refundPayload).select("id"),
    clientB.from("payments").insert(refundRetry).select("id"),
  ]);
  assert.equal([refundA, refundB].filter((result) => !result.error).length, 1, "concurrent refunds were both accepted");
  const successfulRefunds = [refundA, refundB].filter((result) => !result.error);
  assert.equal(successfulRefunds.length, 1, "the same rental amount was refunded twice");
  assert.ok(successfulRefunds[0].data?.[0]?.id, "the accepted refund was not persisted");

  const invoiceA = {
    id: id(), agency_id: agencyB, contract_id: fixture.contract, invoice_number: `SEC-INVOICE-${id()}`,
    kind: "INVOICE", status: "ISSUED", seller_name: "Fixture Agency", buyer_name: "Tenant B",
  };
  const invoiceB = { ...invoiceA, id: id(), invoice_number: `SEC-INVOICE-${id()}` };
  const [issuedA, issuedB] = await Promise.all([
    clientB.from("invoices").insert(invoiceA).select("id"),
    clientB.from("invoices").insert(invoiceB).select("id"),
  ]);
  assert.equal([issuedA, issuedB].filter((result) => !result.error).length, 1, "invoice generation accepted duplicate issued invoices");
  const successfulInvoices = [issuedA, issuedB].filter((result) => !result.error);
  assert.equal(successfulInvoices.length, 1, "one contract has more than one issued invoice");
  assert.ok(successfulInvoices[0].data?.[0]?.id, "the accepted invoice was not persisted");
});

async function cleanup() {
  if (!serviceAdmin) return;
  const cleanupErrors = [];
  const recordError = (error, subject) => {
    if (error) cleanupErrors.push(`${subject}: ${error.message}`);
  };
  if (fixture.documentPath) await serviceAdmin.storage.from("customer-documents").remove([fixture.documentPath]);
  if (fixture.vehicleDocumentPath) await serviceAdmin.storage.from("vehicle-documents").remove([fixture.vehicleDocumentPath]);
  if (fixture.accidentPhotoPath) await serviceAdmin.storage.from("accident-photos").remove([fixture.accidentPhotoPath]);
  for (const agencyId of createdAgencies) {
    const result = await serviceAdmin.rpc("cleanup_test_agency", { p_agency_id: agencyId });
    recordError(result.error, `cleanup_test_agency/${agencyId}`);
  }
  for (const user of createdUsers) {
    const profile = await serviceAdmin.from("profiles").delete().eq("id", user.id);
    recordError(profile.error, `profiles/${user.id}`);
    const result = await serviceAdmin.auth.admin.deleteUser(user.id);
    recordError(result.error, `auth/${user.id}`);
  }
  const remaining = await serviceAdmin.from("agencies").select("id").in("id", createdAgencies);
  recordError(remaining.error, "cleanup verification");
  if (remaining.data?.length) cleanupErrors.push(`agencies remain: ${remaining.data.map((row) => row.id).join(",")}`);
  assert.equal(cleanupErrors.length, 0, `Security fixture cleanup failed: ${cleanupErrors.join("; ")}`);
}

after(cleanup, { skip });
