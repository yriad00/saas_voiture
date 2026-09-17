import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const url = process.env.FLEETHUB_TEST_SUPABASE_URL;
const key = process.env.FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Staging env required (FLEETHUB_TEST_SUPABASE_URL / FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY)");
if (!url.includes("nyurwczpxpcpwqamfoek") || url.includes("wewajfotwphufsthfgul")) throw new Error("Refusing to seed: target is not fleethub-staging");
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const password = () => `QA!${crypto.randomBytes(16).toString("base64url")}`;
const today = new Date();
const isoDate = (offset = 0) => new Date(today.getTime() + offset * 86400000).toISOString().slice(0, 10);
const isoTime = (offset = 0, hour = 10) => `${isoDate(offset)}T${String(hour).padStart(2, "0")}:00:00.000Z`;
const e2eRunId = process.env.FLEETHUB_E2E_RUN_ID?.trim().replace(/[^A-Za-z0-9_-]/g, "");
const isolatedE2E = Boolean(e2eRunId);
const DEMO_SLUG = isolatedE2E ? `fleethub-e2e-${e2eRunId.toLowerCase()}` : "fleethub-demo-agency";
const DEMO_NAME = isolatedE2E ? `TEST_E2E_${e2eRunId} FleetHub Demo Agency` : "FleetHub Demo Agency";

// Hosted E2E runs use fresh synthetic Auth users, but Vercel's edge may
// replace a test x-forwarded-for header with the runner's real IP. Clear only
// the staging login IP buckets before an isolated run so repeated synthetic
// suites do not trip the real brute-force limiter. This script is guarded to
// fleethub-staging above and is never used by the application or production.
if (isolatedE2E) {
  const { error } = await admin.from("login_rate_limit_buckets").delete().like("bucket_key", "ip:%");
  if (error) throw new Error(`staging login bucket reset: ${error.message}`);
}

async function insert(table, payload, select = "id") {
  const { data, error } = await admin.from(table).insert(payload).select(select).single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}
async function findUser(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = (data.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if ((data.users ?? []).length < 200) return null;
    page += 1;
  }
}
async function makeUser(email, fullName, userPassword) {
  const existing = await findUser(email);
  let user;
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, { password: userPassword, email_confirm: true, user_metadata: { full_name: fullName } });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password: userPassword, email_confirm: true, user_metadata: { full_name: fullName } });
    if (error) throw error;
    user = data.user;
  }
  await admin.from("profiles").upsert({ id: user.id, email, full_name: fullName, is_super_admin: false });
  return user;
}

// A rerun is safe: it removes only the exact named/slugged Demo Agency first.
const { data: existingAgency } = await admin.from("agencies").select("id,name,slug").eq("slug", DEMO_SLUG).maybeSingle();
if (existingAgency) {
  const { error } = await import("node:child_process").then(({ execFileSync }) => {
    execFileSync(process.execPath, ["scripts/reset-demo-agency.mjs"], { stdio: "inherit", env: process.env });
    return { error: null };
  }).catch((e) => ({ error: e }));
  if (error) throw error;
}

const emailDomain = isolatedE2E ? "fleethub-e2e.invalid" : "fleethub-demo.invalid";
const emailPrefix = isolatedE2E ? `${e2eRunId.toLowerCase()}-` : "";
const ownerEmail = `${emailPrefix}owner@${emailDomain}`;
const agentEmail = `${emailPrefix}agent@${emailDomain}`;
const ownerPassword = password();
const agentPassword = password();
const owner = await makeUser(ownerEmail, "FleetHub Demo Owner", ownerPassword);
const agent = await makeUser(agentEmail, "FleetHub Demo Agent", agentPassword);
const { data: roles, error: rolesError } = await admin.from("roles").select("id,key").in("key", ["AGENCY_OWNER", "AGENT"]);
if (rolesError) throw rolesError;
const ownerRole = roles.find((r) => r.key === "AGENCY_OWNER")?.id;
const agentRole = roles.find((r) => r.key === "AGENT")?.id;
if (!ownerRole || !agentRole) throw new Error("Required roles are missing");
const { data: plans, error: plansError } = await admin.from("plans").select("id").order("sort_order").limit(1);
if (plansError) throw plansError;
if (!plans?.[0]?.id) throw new Error("No subscription plan exists on staging");

const agency = await insert("agencies", { name: DEMO_NAME, slug: DEMO_SLUG, status: "ACTIVE", city: "Casablanca", country: "Morocco", currency: "MAD", timezone: "Africa/Casablanca", email: "qa@fleethub-demo.invalid", phone: "+212600000099", address: "Adresse synthétique QA", created_by: owner.id });
const agencyId = agency.id;
await insert("agency_settings", { agency_id: agencyId, tax_rate: 20, default_deposit: 3000, deposit_required: true, cancellation_policy: "QA synthetic policy" }, "agency_id");
await insert("subscriptions", { agency_id: agencyId, plan_id: plans[0].id, status: "ACTIVE", started_at: new Date().toISOString() }, "id");
const casa = await insert("branches", { agency_id: agencyId, name: "Casablanca", code: "CASA", city: "Casablanca", address: "Boulevard QA Casablanca", phone: "+212522000099", whatsapp: "+212600000099", email: "casa@fleethub-demo.invalid", active: true });
const marr = await insert("branches", { agency_id: agencyId, name: "Marrakech", code: "MARR", city: "Marrakech", address: "Avenue QA Marrakech", phone: "+212524000099", whatsapp: "+212600000098", email: "marr@fleethub-demo.invalid", active: true });
await insert("agency_members", { agency_id: agencyId, profile_id: owner.id, role_id: ownerRole, status: "active", joined_at: new Date().toISOString() });
await insert("agency_members", { agency_id: agencyId, profile_id: agent.id, role_id: agentRole, branch_id: casa.id, status: "active", joined_at: new Date().toISOString() });

const customers = [];
const names = [["Ahmed", "El Amrani"], ["Fatima Zahra", "Alaoui"], ["Youssef", "Benali"], ["Salma", "Idrissi"], ["Omar", "Tazi"], ["Lina", "Chraibi"], ["Hamza", "Naciri"], ["Nadia", "Bennani"]];
for (let i = 0; i < names.length; i++) {
  const [first_name, last_name] = names[i];
  customers.push(await insert("customers", { agency_id: agencyId, first_name, last_name, phone: `+2126000100${String(i + 1).padStart(2, "0")}`, whatsapp: `+2126000100${String(i + 1).padStart(2, "0")}`, email: `client${i + 1}@fleethub-demo.invalid`, id_type: "CIN", id_number: `QA-CIN-${String(i + 1).padStart(3, "0")}`, id_expiry: isoDate(730), driver_license_number: `QA-PERMIS-${String(i + 1).padStart(3, "0")}`, driver_license_issued_at: isoDate(-365), driver_license_expiry: isoDate(730), nationality: "Marocaine", address: "Adresse synthétique QA", city: i % 2 ? "Marrakech" : "Casablanca", notes: "SYNTHETIC_TEST — données fictives" }));
}

const vehicles = [];
const vehicleSpecs = [
  ["Dacia", "Logan", "CASA-QA-001", casa.id, "Economique", "GASOLINE", "MANUAL", "AVAILABLE", 280, "OWNED"],
  ["Renault", "Clio", "CASA-QA-002", casa.id, "Economique", "GASOLINE", "MANUAL", "AVAILABLE", 320, "SUBLEASE"],
  ["Dacia", "Duster", "CASA-QA-003", casa.id, "SUV", "DIESEL", "MANUAL", "AVAILABLE", 520, "OWNED"],
  ["Peugeot", "208", "CASA-QA-004", casa.id, "Compacte", "GASOLINE", "AUTOMATIC", "AVAILABLE", 390, "OWNED"],
  ["Hyundai", "i10", "MARR-QA-005", marr.id, "Economique", "GASOLINE", "MANUAL", "AVAILABLE", 260, "OWNED"],
  ["Renault", "Express", "MARR-QA-006", marr.id, "Utilitaire", "DIESEL", "MANUAL", "AVAILABLE", 450, "OWNED"],
  ["Toyota", "Corolla", "MARR-QA-007", marr.id, "Berline", "HYBRID", "AUTOMATIC", "RENTED", 480, "OWNED"],
  ["Kia", "Picanto", "MARR-QA-008", marr.id, "Economique", "GASOLINE", "MANUAL", "MAINTENANCE", 250, "OWNED"],
  // Dedicated one-way browser fixture starts in Casablanca and returns to
  // Marrakech; keeping it separate prevents other scenarios from reserving it.
  ["Skoda", "Fabia", "CASA-QA-009", casa.id, "Compacte", "GASOLINE", "MANUAL", "AVAILABLE", 330, "OWNED"],
  // Dedicated second replacement vehicle keeps the two sequential swap
  // scenarios independent from the active rental's normal fleet.
  ["Nissan", "Micra", "MARR-QA-010", marr.id, "Economique", "GASOLINE", "MANUAL", "AVAILABLE", 290, "OWNED"],
  ["Suzuki", "Swift", "MARR-QA-011", marr.id, "Compacte", "GASOLINE", "MANUAL", "AVAILABLE", 300, "OWNED"],
  // Separate release-matrix one-way vehicle. The full one-way acceptance test
  // moves its own dedicated vehicle to Marrakech, so these scenarios must not
  // share mutable branch state.
  ["Honda", "Jazz", "CASA-QA-012", casa.id, "Compacte", "GASOLINE", "AUTOMATIC", "AVAILABLE", 340, "OWNED"],
];
for (let i = 0; i < vehicleSpecs.length; i++) {
  const [brand, model, plate, branch_id, category, fuel_type, transmission, status, daily_rate, ownership_type] = vehicleSpecs[i];
  vehicles.push(await insert("vehicles", { agency_id: agencyId, branch_id, brand, model, year: 2022 + (i % 3), color: i % 2 ? "Blanc" : "Gris", license_plate: plate, vin: `QA-SYNTHETIC-VIN-${String(i + 1).padStart(3, "0")}`, category, seats: 5, doors: 4, fuel_type, transmission, status, mileage: 18000 + i * 1700, daily_rate, weekly_rate: daily_rate * 6, monthly_rate: daily_rate * 22, deposit_amount: 3000, ownership_type, notes: "SYNTHETIC_TEST — véhicule de démonstration", owner_name: ownership_type === "SUBLEASE" ? "Partenaire synthétique QA" : null, owner_phone: ownership_type === "SUBLEASE" ? "+212600000088" : null, owner_cost_per_day: ownership_type === "SUBLEASE" ? 180 : 0, owner_cost_type: "FIXED_DAILY" }));
}

await insert("extras_catalog", { agency_id: agencyId, branch_id: null, code: "BABY-SEAT", name: "Siège bébé", pricing_type: "FLAT", price: 150, active: true, created_by: owner.id });
// Dummy private documents: a tiny synthetic PDF marker, never personal data.
const dummyPdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 83, 89, 78, 84, 72, 69, 84, 73, 67, 95, 84, 69, 83, 84]);
for (let i = 0; i < customers.length; i++) {
  for (const [type, suffix] of [["CIN_RECTO", "cin-recto"], ["DRIVER_LICENSE_RECTO", "permis-recto"]]) {
    const path = `${agencyId}/${customers[i].id}/${suffix}.pdf`;
    const { error } = await admin.storage.from("customer-documents").upload(path, dummyPdf, { contentType: "application/pdf", upsert: true });
    if (error) throw error;
    await insert("customer_documents", { agency_id: agencyId, customer_id: customers[i].id, document_type: type, storage_path: path, file_name: `${suffix}.pdf`, content_type: "application/pdf", size_bytes: dummyPdf.length, created_by: owner.id });
  }
}
const expiringPath = `${agencyId}/${vehicles[0].id}/assurance-qa.pdf`;
await admin.storage.from("vehicle-documents").upload(expiringPath, dummyPdf, { contentType: "application/pdf", upsert: true });
await insert("vehicle_documents", { agency_id: agencyId, vehicle_id: vehicles[0].id, document_type: "ASSURANCE", document_number: "QA-ASSURANCE-001", issued_at: isoDate(-350), expires_at: isoDate(10), storage_path: expiringPath, file_name: "assurance-qa.pdf", content_type: "application/pdf", size_bytes: dummyPdf.length, created_by: owner.id });

// Today pickup, future reservation, and one active rental returning today.
const reservation = await insert("reservations", { agency_id: agencyId, branch_id: casa.id, pickup_branch_id: casa.id, return_branch_id: casa.id, customer_id: customers[0].id, vehicle_id: vehicles[0].id, reference: "QA-DEMO-RES-TODAY", start_date: isoDate(0), end_date: isoDate(3), pickup_location: "Casablanca — agence", return_location: "Casablanca — agence", daily_rate: 280, total_days: 3, base_total_amount: 840, total_amount: 840, status: "CONFIRMED", source: "WALK_IN", deposit_amount: 3000, advance_amount: 300, remaining_amount: 540, notes: "SYNTHETIC_TEST — départ aujourd'hui", created_by: owner.id });
const activeContract = await insert("contracts", { agency_id: agencyId, branch_id: marr.id, pickup_branch_id: marr.id, return_branch_id: marr.id, customer_id: customers[1].id, payer_customer_id: customers[1].id, principal_driver_customer_id: customers[1].id, vehicle_id: vehicles[6].id, contract_number: "QA-DEMO-CONTRACT-ACTIVE", start_date: isoDate(-2), end_date: isoDate(0), start_mileage: 24500, fuel_level_start: 7, daily_rate: 480, deposit_amount: 3000, base_total_amount: 960, total_amount: 960, status: "ACTIVE", terms: "Conditions synthétiques QA — FR", terms_ar: "شروط تجريبية تركيبية — AR", contract_language: "BILINGUAL", created_by: owner.id });
await insert("contract_checkouts", { agency_id: agencyId, branch_id: marr.id, contract_id: activeContract.id, vehicle_id: vehicles[6].id, checkout_at: isoTime(-2, 10), mileage: 24500, fuel_level: 7, cleanliness: "CLEAN", accessories: ["triangle", "gilet"], keys_count: 2, signature_name: "Ahmed Synthetic", notes: "SYNTHETIC_TEST — check-out exemple", created_by: owner.id });
// A second active dossier keeps the photo retry surface in return review,
// while QA can still exercise extension/swap on the main active rental.
const photoContract = await insert("contracts", { agency_id: agencyId, branch_id: marr.id, pickup_branch_id: marr.id, return_branch_id: marr.id, customer_id: customers[3].id, payer_customer_id: customers[3].id, principal_driver_customer_id: customers[3].id, vehicle_id: vehicles[5].id, contract_number: "QA-DEMO-CONTRACT-PHOTOS", start_date: isoDate(-1), end_date: isoDate(1), start_mileage: 18400, fuel_level_start: 6, daily_rate: 450, deposit_amount: 3000, base_total_amount: 900, total_amount: 900, status: "ACTIVE", terms: "Constat photo synthétique QA", created_by: owner.id });
await insert("contract_checkouts", { agency_id: agencyId, branch_id: marr.id, contract_id: photoContract.id, vehicle_id: vehicles[5].id, checkout_at: isoTime(-1, 10), mileage: 18400, fuel_level: 6, cleanliness: "CLEAN", accessories: ["triangle"], keys_count: 2, signature_name: "Salma Synthetic", notes: "SYNTHETIC_TEST — check-out photo", created_by: owner.id });
await insert("contract_inspections", { agency_id: agencyId, branch_id: marr.id, contract_id: photoContract.id, inspection_type: "PICKUP", inspected_at: isoTime(-1, 10), mileage: 18400, fuel_level: 6, signature_name: "Salma Synthetic", notes: "SYNTHETIC_TEST — constat de remise photo", created_by: owner.id });
await insert("contract_checkins", { agency_id: agencyId, branch_id: marr.id, contract_id: photoContract.id, vehicle_id: vehicles[5].id, actual_return_at: isoTime(1, 18), returned_by: owner.id, return_mileage: 18400, fuel_level: 6, cleanliness: "CLEAN", missing_items: [], notes: "SYNTHETIC_TEST — revue de retour photo", signature_name: "Salma Synthetic", status: "REVIEW" });
await admin.from("vehicles").update({ status: "RENTED" }).eq("id", vehicles[5].id).eq("agency_id", agencyId);
await insert("payments", { agency_id: agencyId, branch_id: marr.id, contract_id: activeContract.id, customer_id: customers[1].id, amount: 500, method: "CASH", type: "RENTAL", status: "COMPLETED", reference: "QA-DEMO-PAY-ADVANCE", notes: "Paiement synthétique — reste à collecter", created_by: owner.id, idempotency_key: "QA-DEMO-PAY-ADVANCE" });
const deposit = await insert("deposits", { agency_id: agencyId, branch_id: marr.id, contract_id: activeContract.id, required_amount: 3000, received_amount: 0, held_amount: 0, status: "REQUIRED" });
await insert("deposit_transactions", { agency_id: agencyId, branch_id: marr.id, deposit_id: deposit.id, transaction_type: "RECEIVED", amount: 3000, reason: "Caution synthétique — cash", created_by: owner.id, idempotency_key: "QA-DEMO-DEPOSIT-RECEIVED" });
const session = await insert("cash_sessions", { agency_id: agencyId, branch_id: casa.id, opening_balance: 1000, opened_by: owner.id, status: "OPEN" });
await insert("cash_movements", { agency_id: agencyId, branch_id: casa.id, session_id: session.id, movement_type: "PAYMENT", amount: 300, reference_type: "RESERVATION", reference_id: reservation.id, reason: "Avance synthétique", created_by: owner.id });
await insert("maintenance_records", { agency_id: agencyId, branch_id: marr.id, vehicle_id: vehicles[7].id, type: "INSPECTION", description: "Visite technique — exemple QA", cost: 850, mileage_at_service: 33500, service_date: isoDate(-3), next_service_date: isoDate(180), garage_name: "Garage synthétique QA", status: "IN_PROGRESS", created_by: owner.id });
const subleaseContract = await insert("contracts", { agency_id: agencyId, branch_id: casa.id, pickup_branch_id: casa.id, return_branch_id: casa.id, customer_id: customers[2].id, payer_customer_id: customers[2].id, principal_driver_customer_id: customers[2].id, vehicle_id: vehicles[1].id, contract_number: "QA-DEMO-CONTRACT-SUBLEASE", start_date: isoDate(-10), end_date: isoDate(-7), start_mileage: 12000, end_mileage: 12400, daily_rate: 400, deposit_amount: 3000, base_total_amount: 1200, total_amount: 1200, final_total_amount: 1200, status: "CLOSED", terms: "Sous-location synthétique QA", created_by: owner.id });
await insert("vehicle_owner_settlements", { agency_id: agencyId, branch_id: casa.id, vehicle_id: vehicles[1].id, contract_id: subleaseContract.id, owner_name: "Partenaire synthétique QA", owner_contact: "+212600000088", rental_revenue: 1200, owner_amount: 540, agency_margin: 660, paid_amount: 0, status: "UNPAID", notes: "Sous-location — exemple synthétique", created_by: owner.id });
await insert("delivery_missions", { agency_id: agencyId, branch_id: casa.id, vehicle_id: vehicles[0].id, customer_id: customers[0].id, reservation_id: reservation.id, mission_type: "CUSTOMER_ADDRESS", address: "Adresse synthétique Casablanca", location: "Casablanca", scheduled_at: isoTime(0, 11), fee: 100, notes: "SYNTHETIC_TEST — livraison exemple", status: "PLANNED", created_by: owner.id });

// A real second synthetic tenant is used by the browser isolation case. It is
// deliberately not a member of the demo owner, so the browser must receive
// the same not-found response as any other tenant-owned record.
const foreignAgency = await insert("agencies", { name: `TEST_E2E_${e2eRunId ?? "MANUAL"} FOREIGN`, slug: `${DEMO_SLUG}-foreign`, status: "ACTIVE", city: "Rabat", country: "Morocco", currency: "MAD", timezone: "Africa/Casablanca", email: "foreign@fleethub-e2e.invalid", phone: "+212600000077", address: "Adresse synthetic foreign", created_by: owner.id });
const foreignBranch = await insert("branches", { agency_id: foreignAgency.id, name: "Foreign Branch", code: "FOR", city: "Rabat", active: true });
const foreignCustomer = await insert("customers", { agency_id: foreignAgency.id, first_name: "TEST_E2E", last_name: "Foreign Client", phone: "+212600000076", id_type: "CIN", id_number: `TEST_E2E_${e2eRunId ?? "MANUAL"}_FOREIGN_CIN` });
const foreignVehicle = await insert("vehicles", { agency_id: foreignAgency.id, branch_id: foreignBranch.id, brand: "Dacia", model: "Foreign", year: 2024, license_plate: `FOR-${(e2eRunId ?? "MANUAL").slice(-6)}`, status: "AVAILABLE", daily_rate: 250, deposit_amount: 2000, ownership_type: "OWNED", category: "Economique" });
const foreignContract = await insert("contracts", { agency_id: foreignAgency.id, branch_id: foreignBranch.id, pickup_branch_id: foreignBranch.id, return_branch_id: foreignBranch.id, customer_id: foreignCustomer.id, payer_customer_id: foreignCustomer.id, principal_driver_customer_id: foreignCustomer.id, vehicle_id: foreignVehicle.id, contract_number: `TEST-E2E-FOREIGN-${(e2eRunId ?? "MANUAL").slice(-6)}`, start_date: isoDate(-5), end_date: isoDate(-2), daily_rate: 250, base_total_amount: 750, total_amount: 750, final_total_amount: 750, status: "CLOSED", created_by: owner.id });

console.log(JSON.stringify({
  agency: { id: agencyId, name: DEMO_NAME, slug: DEMO_SLUG },
  branches: { casablanca: casa.id, marrakech: marr.id },
  counts: { vehicles: vehicles.length, customers: customers.length },
  // Keep dedicated vehicles for browser scenarios so a reservation created by
  // one case cannot leave another case's availability assertion ambiguous.
  vehicles: { owned: vehicles[0].id, sublease: vehicles[1].id, transfer: vehicles[2].id, free: vehicles[3].id, oneWay: vehicles[8].id, oneWayRelease: vehicles[11].id, replacement: vehicles[9].id, replacement2: vehicles[10].id },
  owner: { email: ownerEmail, password: ownerPassword },
  agent: { email: agentEmail, password: agentPassword },
  reservation: reservation.id,
  activeContract: activeContract.id,
  photoContract: photoContract.id,
  subleaseContract: subleaseContract.id,
  foreign: { agencyId: foreignAgency.id, contractId: foreignContract.id },
  e2eRunId: e2eRunId ?? null,
  note: "SYNTHETIC_TEST only; credentials are temporary and are not stored in the repository",
}));
