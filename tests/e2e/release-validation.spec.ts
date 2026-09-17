import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { one, rows, count } from "./staging-db";

const agentAuthPath = path.join(process.cwd(), "test-results", ".fleethub-e2e", "agent-storage.json");

type Fixture = {
  reservation: string;
  activeContract: string;
  photoContract?: string;
  subleaseContract: string;
  owner: { email: string; password: string };
  agent: { email: string; password: string };
  vehicles: Record<string, string>;
  agency?: { id: string; name: string; slug: string };
  foreign?: { agencyId: string; contractId: string };
};
type E2EContext = { hostedUrl: string; fixture: Fixture; e2eIp?: string };

function readContext(): E2EContext {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "test-results", ".fleethub-e2e", "context.json"), "utf8")) as E2EContext;
}

async function open(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();
}

async function expectText(page: Page, text: string | RegExp) {
  // Hosted Vercel can queue a cold serverless invocation for ~20s even when
  // the action itself completes in ~3s (verified in Vercel logs). Keep the
  // assertion strict while allowing the measured transport window; the
  // submit button's pending state remains visible immediately in the UI.
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 30_000 });
}

async function openSection(page: Page, label: string) {
  const section = page.locator("summary", { hasText: label }).first();
  await expect(section).toBeVisible();
  await section.click();
}

function browserContextOptions() {
  const context = readContext();
  return context.e2eIp ? { extraHTTPHeaders: { "x-forwarded-for": context.e2eIp } } : {};
}

function idFromUrl(url: string, segment: string) {
  const match = new URL(url).pathname.match(new RegExp(`/agency/${segment}/([^/]+)`));
  if (!match?.[1]) throw new Error(`Expected ${segment} id in URL: ${url}`);
  return match[1];
}

async function openActiveContract(page: Page) {
  const { fixture } = readContext();
  await open(page, `/agency/contracts/${fixture.activeContract}`);
}

async function openPhotoContract(page: Page) {
  const { fixture } = readContext();
  await open(page, `/agency/contracts/${fixture.photoContract ?? fixture.activeContract}`);
}

async function fillReservation(page: Page, start: string, end: string, withVehicle = true) {
  const customer = await page.locator("#customer_id option").nth(1).getAttribute("value");
  expect(customer).toBeTruthy();
  await page.locator("#customer_id").selectOption(customer!);
  if (withVehicle) {
    const vehicle = await page.locator("#vehicle_id option").nth(1).getAttribute("value");
    expect(vehicle).toBeTruthy();
    await page.locator("#vehicle_id").selectOption(vehicle!);
  } else {
    await page.locator("#vehicle_id").selectOption("");
    await page.locator("#vehicle_category").selectOption({ label: "Economique" });
  }
  await page.locator("#start_date").fill(start);
  await page.locator("#end_date").fill(end);
  await page.locator("#pickup_location").fill("Casablanca — test staging");
  await page.locator("#return_location").fill("Casablanca — test staging");
  await page.locator("#deposit_amount").fill("3000");
  await page.locator("#advance_amount").fill("300");
  await page.locator("#notes").fill("TEST_BROWSER — release validation");
}

async function createReservationFromUi(page: Page, start: string, end: string) {
  await open(page, "/agency/reservations/new");
  await fillReservation(page, start, end);
  await page.getByRole("button", { name: "Créer la réservation", exact: true }).click();
  await expectText(page, "Réservation créée");
  const href = await page.getByRole("link", { name: "Ouvrir la réservation", exact: true }).getAttribute("href");
  expect(href).toMatch(/\/agency\/reservations\/[0-9a-f-]+$/i);
  await page.goto(href!, { waitUntil: "domcontentloaded" });
  return idFromUrl(page.url(), "reservations");
}

test.describe("FleetHub release validation — hosted staging only", () => {
  test.describe.configure({ mode: "default" });

  test("01 standard rental lifecycle surfaces are connected", async ({ page }) => {
    const { fixture } = readContext();
    await open(page, "/agency/reservations/new");
    await expect(page.locator("#customer_id")).toBeVisible();
    await expect(page.locator("#vehicle_id")).toBeVisible();
    await expect(page.locator("#start_date")).toBeVisible();
    await expect(page.locator("#deposit_amount")).toBeVisible();
    await expect(page.locator("#advance_amount")).toBeVisible();
    await openActiveContract(page);
    await expect(page.locator('[aria-label="Progression de la location"]')).toBeVisible();
    await expectText(page, "Check-out mobile");
    await expectText(page, "Check-in / retour mobile");
    await expect(page.getByRole("heading", { name: "Caution", exact: true }).first()).toBeVisible();
    const contract = await one("contracts", { id: fixture.activeContract });
    const checkouts = await rows("contract_checkouts", { contract_id: fixture.activeContract });
    const deposits = await rows("deposits", { contract_id: fixture.activeContract });
    expect(contract?.status).toBe("ACTIVE");
    expect(checkouts.length).toBeGreaterThan(0);
    expect(deposits.length).toBe(1);
    expect(Number(deposits[0].required_amount)).toBe(3000);
  });

  test("02 double booking is rejected by the UI/server workflow", async ({ page }) => {
    const { fixture } = readContext();
    await open(page, "/agency/reservations/new");
    await fillReservation(page, "2099-01-05", "2099-01-08");
    await page.getByRole("button", { name: "Créer la réservation", exact: true }).click();
    await expectText(page, "Réservation créée");
    const createdHref = await page.getByRole("link", { name: "Ouvrir la réservation", exact: true }).getAttribute("href");
    expect(createdHref).toMatch(/\/agency\/reservations\/[0-9a-f-]+$/i);
    await page.goto(createdHref!, { waitUntil: "domcontentloaded" });
    const reservationId = idFromUrl(page.url(), "reservations");
    const created = await one("reservations", { id: reservationId });
    expect(created?.id).toBe(reservationId);
    const vehicleId = String(created?.vehicle_id ?? "");
    const before = await count("reservations", { agency_id: String(fixture.agency?.id ?? "") });
    await open(page, "/agency/reservations/new");
    await fillReservation(page, "2099-01-05", "2099-01-08");
    await page.getByRole("button", { name: "Créer la réservation", exact: true }).click();
    await expectText(page, /indisponible|conflit|déjà réservé/i);
    const after = await count("reservations", { agency_id: String(fixture.agency?.id ?? "") });
    expect(after).toBe(before);
    expect(vehicleId).toBeTruthy();
  });

  test("03 extension exposes future conflict validation", async ({ page }) => {
    const { fixture } = readContext();
    const contract = await one("contracts", { id: fixture.activeContract });
    expect(contract?.vehicle_id).toBeTruthy();
    await open(page, "/agency/reservations/new");
    await fillReservation(page, "2099-09-01", "2099-09-03");
    await page.locator("#vehicle_id").selectOption(String(contract?.vehicle_id));
    await page.getByRole("button", { name: "Créer la réservation", exact: true }).click();
    await expectText(page, "Réservation créée");
    await openActiveContract(page);
    await openSection(page, "Prolonger cette location");
    await expect(page.locator("#extension_date")).toBeVisible();
    await expect(page.locator("#extension_reason")).toBeVisible();
    await page.locator("#extension_date").fill("2099-09-02");
    await page.locator("#extension_reason").fill("TEST_BROWSER future reservation conflict");
    await page.getByRole("button", { name: "Prolonger", exact: true }).click();
    await expectText(page, /réservé|conflit|période prolongée/i);
    expect(await count("rental_extensions", { contract_id: fixture.activeContract })).toBe(0);
  });

  test("04 category reservation works without an assigned vehicle", async ({ page }) => {
    const { fixture } = readContext();
    await open(page, "/agency/reservations/new");
    await fillReservation(page, "2099-02-05", "2099-02-08", false);
    await page.getByRole("button", { name: "Créer la réservation", exact: true }).click();
    await expectText(page, "Réservation créée");
    const createdHref = await page.getByRole("link", { name: "Ouvrir la réservation", exact: true }).getAttribute("href");
    expect(createdHref).toMatch(/\/agency\/reservations\/[0-9a-f-]+$/i);
    await page.goto(createdHref!, { waitUntil: "domcontentloaded" });
    const reservationId = idFromUrl(page.url(), "reservations");
    const created = await one("reservations", { id: reservationId });
    expect(created?.vehicle_id).toBeNull();
    expect(String(created?.vehicle_category ?? "")).toBe("Economique");
    const assignSelect = page.getByRole("combobox", { name: "Véhicule à attribuer" });
    await expect(assignSelect).toBeVisible();
    const assignable = await assignSelect.locator("option").evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value).filter(Boolean));
    expect(assignable.length).toBeGreaterThan(0);
    // Use the seeded Economique vehicle so the server-side category guard is
    // exercised instead of relying on the sort order of available vehicles.
    const targetVehicle = fixture.vehicles.sublease && assignable.includes(fixture.vehicles.sublease)
      ? fixture.vehicles.sublease
      : assignable[0];
    await assignSelect.selectOption(targetVehicle);
    await page.getByRole("button", { name: "Attribuer ce véhicule", exact: true }).click();
    await expect(page.getByText("Aucun véhicule attribué", { exact: true })).toHaveCount(0, { timeout: 15_000 });
    const assigned = await one("reservations", { id: reservationId });
    expect(assigned?.vehicle_id).toBe(targetVehicle);
    // The server action revalidates the dossier, so the success state is
    // rendered as the assigned vehicle card rather than a transient form
    // message. Assert that visible outcome and persisted state together.
    const assignedVehicle = await one("vehicles", { id: targetVehicle });
    await expectText(page, new RegExp(`${String(assignedVehicle?.brand ?? "")}.*${String(assignedVehicle?.model ?? "")}`, "i"));
    await expect(page.getByText("Aucun véhicule attribué", { exact: true })).toHaveCount(0);
  });

  test("05 payer can differ from principal driver", async ({ page }) => {
    const { fixture } = readContext();
  await openActiveContract(page);
  await openSection(page, "Modifier payeur et conducteurs");
  await expect(page.locator("#payer_customer_id")).toBeVisible();
  await expect(page.locator("#principal_driver_customer_id")).toBeVisible();
  const options = await page.locator("#payer_customer_id option").evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value).filter(Boolean));
    expect(options.length, "The isolated browser fixture must provide separate payer and driver customers").toBeGreaterThanOrEqual(2);
    await page.locator("#payer_customer_id").selectOption(options[0]);
    await page.locator("#principal_driver_customer_id").selectOption(options[1]);
    await page.getByRole("button", { name: "Enregistrer les rôles", exact: true }).click();
    await expectText(page, "Rôles enregistrés.");
    const participants = await rows("rental_participants", { contract_id: fixture.activeContract });
    expect(participants.some((row) => row.role === "PAYER" && row.customer_id === options[0])).toBe(true);
    expect(participants.some((row) => row.role === "PRINCIPAL_DRIVER" && row.customer_id === options[1])).toBe(true);
  });

  test("06 additional driver can be attached", async ({ page }) => {
    const { fixture } = readContext();
  await openActiveContract(page);
  await openSection(page, "Modifier payeur et conducteurs");
  const additional = page.locator("#additional_driver_ids");
  await expect(additional).toBeVisible();
  const values = await additional.locator("option").evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value).filter(Boolean));
    expect(values.length, "The isolated browser fixture must provide an additional driver").toBeGreaterThan(0);
    await additional.selectOption(values[values.length - 1]);
    await expect(additional).toHaveValues([values[values.length - 1]]);
    await page.getByRole("button", { name: "Enregistrer les rôles", exact: true }).click();
    await expectText(page, "Rôles enregistrés.");
    const participants = await rows("rental_participants", { contract_id: fixture.activeContract });
    expect(participants.some((row) => row.role === "ADDITIONAL_DRIVER" && row.customer_id === values[values.length - 1])).toBe(true);
  });

  test("07 mixed payment methods are recorded and remain linked to the rental", async ({ page }) => {
    const { fixture } = readContext();
    await open(page, `/agency/payments/new?contract=${fixture.activeContract}`);
    await expect(page.locator("#method")).toBeVisible();
    await expect(page.locator("#method option[value='CASH']")).toHaveCount(1);
    await expect(page.locator("#method option[value='CARD']")).toHaveCount(1);
    await expect(page.locator("#method option[value='TRANSFER']")).toHaveCount(1);
    const before = await count("payments", { contract_id: fixture.activeContract });
    await page.locator("#amount").fill("10");
    await page.locator("#method").selectOption("TRANSFER");
    await page.getByRole("button", { name: "Enregistrer le paiement", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/agency/contracts/${fixture.activeContract}`));
    await open(page, `/agency/payments/new?contract=${fixture.activeContract}`);
    await page.locator("#amount").fill("10");
    await page.locator("#method").selectOption("CARD");
    await page.getByRole("button", { name: "Enregistrer le paiement", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/agency/contracts/${fixture.activeContract}`));
    const payments = await rows("payments", { contract_id: fixture.activeContract });
    expect(payments.length).toBe(before + 2);
    expect(payments.filter((row) => row.amount === 10 || Number(row.amount) === 10).map((row) => row.method)).toEqual(expect.arrayContaining(["TRANSFER", "CARD"]));
  });

  test("08 deposit page exposes duplicate-safe refund workflow", async ({ page }) => {
    const { fixture } = readContext();
    await openActiveContract(page);
    await expectText(page, "Disponible à déduire/rembourser");
    await expect(page.locator("#transaction_type")).toBeVisible();
    await expect(page.locator("#transaction_type option[value='REFUND']")).toHaveCount(1);
    // The key is intentionally readonly/hidden from normal staff; assert it is
    // present in the submitted form without requiring it to be user-editable.
    const key = page.locator("input[name='idempotency_key']").first();
    await expect(key).toBeAttached();
    const value = await key.inputValue();
    const before = await count("deposit_transactions", { deposit_id: String((await one("deposits", { contract_id: fixture.activeContract }))?.id) });
    await page.locator("#transaction_type").selectOption("REFUND");
    await page.locator("#deposit_amount_tx").fill("1");
    await page.locator("#deposit_reason").fill("TEST_BROWSER duplicate-safe refund");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expectText(page, "Opération de caution enregistrée.");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expectText(page, "Opération de caution enregistrée.");
    const depositId = String((await one("deposits", { contract_id: fixture.activeContract }))?.id);
    const afterRows = await rows("deposit_transactions", { deposit_id: depositId });
    expect(afterRows.filter((row) => row.idempotency_key === value)).toHaveLength(1);
    expect(afterRows.length).toBe(before + 1);
  });

  test("09 active rental supports vehicle change", async ({ page }) => {
    const { fixture } = readContext();
    await openActiveContract(page);
    await openSection(page, "Remplacer ce véhicule");
    await expect(page.locator("#swap_vehicle")).toBeVisible();
    await expect(page.locator("#swap_reason")).toBeVisible();
    const targets = await page.locator("#swap_vehicle option").evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value).filter(Boolean));
    expect(targets.length).toBeGreaterThan(0);
    const replacement = readContext().fixture.vehicles.replacement;
    const selectedVehicle = replacement && targets.includes(replacement) ? replacement : targets[0];
    await page.locator("#swap_vehicle").selectOption(selectedVehicle);
    await page.locator("#swap_reason").fill("TEST_BROWSER vehicle change");
    await page.getByRole("button", { name: "Changer le véhicule", exact: true }).click();
    await expectText(page, "Swap enregistré.");
    const swaps = await rows("vehicle_swaps", { contract_id: fixture.activeContract });
    expect(swaps).toHaveLength(1);
    expect(swaps[0].new_vehicle_id).toBe(selectedVehicle);
  });

  test("10 breakdown replacement keeps the same swap workflow", async ({ page }) => {
    const { fixture } = readContext();
    await openActiveContract(page);
    await openSection(page, "Remplacer ce véhicule");
    await page.locator("#swap_reason").fill("Panne — remplacement temporaire TEST_BROWSER");
    const targets = await page.locator("#swap_vehicle option").evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value).filter(Boolean));
    expect(targets.length).toBeGreaterThan(0);
    const replacement = readContext().fixture.vehicles.replacement2 ?? readContext().fixture.vehicles.replacement;
    const selectedVehicle = replacement && targets.includes(replacement) ? replacement : targets[0];
    await page.locator("#swap_vehicle").selectOption(selectedVehicle);
    await page.getByRole("button", { name: "Changer le véhicule", exact: true }).click();
    await expectText(page, "Swap enregistré.");
    const swaps = await rows("vehicle_swaps", { contract_id: fixture.activeContract });
    expect(swaps).toHaveLength(2);
    expect(new Set(swaps.map((swap) => swap.old_vehicle_id)).size).toBeGreaterThan(0);
  });

  test("11 sub-rental owner cost, margin and settlement are visible", async ({ page }) => {
    const { fixture } = readContext();
    await open(page, "/agency/contracts");
    await expectText(page, "QA-DEMO-CONTRACT-SUBLEASE");
    await page.getByRole("link", { name: "QA-DEMO-CONTRACT-SUBLEASE", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Règlement propriétaire", exact: true })).toBeVisible();
    await page.locator("#owner_amount").fill("540");
    await page.locator("#paid_amount").fill("540");
    await page.getByRole("button", { name: "Enregistrer le règlement", exact: true }).click();
    await expectText(page, "Règlement propriétaire enregistré.");
    const settlements = await rows("vehicle_owner_settlements", { contract_id: fixture.subleaseContract });
    expect(settlements).toHaveLength(1);
    expect(Number(settlements[0].agency_margin)).toBe(660);
    expect(Number(settlements[0].paid_amount)).toBe(540);
    expect(settlements[0].status).toBe("PAID");
  });

  test("12 one-way rental exposes separate pickup and return branches", async ({ page }) => {
    const { fixture } = readContext();
    await open(page, "/agency/reservations/new");
    await fillReservation(page, "2099-04-05", "2099-04-08");
    await expect(page.locator("#pickup_branch_id")).toBeVisible();
    await expect(page.locator("#return_branch_id")).toBeVisible();
    await expect(page.locator("#one_way_fee")).toBeVisible();
    const branches = await page.locator("#pickup_branch_id option").evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value).filter(Boolean));
    const returnBranches = await page.locator("#return_branch_id option").evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value).filter(Boolean));
    expect(branches.length).toBeGreaterThan(0);
    expect(returnBranches.length).toBeGreaterThan(0);
    // Use a seeded vehicle that is physically in the selected pickup branch;
    // the server rejects a mismatched branch instead of silently relocating
    // the booking.
    const releaseOneWayVehicle = fixture.vehicles.oneWayRelease ?? fixture.vehicles.owned ?? fixture.vehicles.free;
    await page.locator("#vehicle_id").selectOption({ value: releaseOneWayVehicle });
    await expect(page.locator("#vehicle_id")).toHaveValue(releaseOneWayVehicle);
    await page.locator("#one_way_fee").fill("200");
    // Set branches after all controlled fields have been filled. The form
    // re-renders on each controlled field change; selecting the route last
    // ensures the browser serializes the visible one-way values.
    // The seed deliberately places the dedicated one-way vehicle in
    // Casablanca. Select by the visible operational label rather than relying
    // on database row ordering, which can vary between staging runs.
    await page.locator("#pickup_branch_id").selectOption({ label: "Casablanca (CASA)" });
    const selectedPickupBranch = await page.locator("#pickup_branch_id").inputValue();
    const selectedReturnBranch = (await page.locator("#return_branch_id option").evaluateAll((items) => items.find((item) => (item as HTMLOptionElement).textContent?.includes("Marrakech"))?.getAttribute("value"))) ?? returnBranches[0];
    await page.locator("#return_branch_id").selectOption(selectedReturnBranch);
    await expect(page.locator("#pickup_branch_id")).toHaveValue(selectedPickupBranch);
    await expect(page.locator("#return_branch_id")).toHaveValue(selectedReturnBranch);
    await page.getByRole("button", { name: "Créer la réservation", exact: true }).click();
    await expectText(page, "Réservation créée");
    const createdHref = await page.getByRole("link", { name: "Ouvrir la réservation", exact: true }).getAttribute("href");
    expect(createdHref).toMatch(/\/agency\/reservations\/[0-9a-f-]+$/i);
    await page.goto(createdHref!, { waitUntil: "domcontentloaded" });
    const reservationId = idFromUrl(page.url(), "reservations");
    const created = await one("reservations", { id: reservationId });
    expect(created?.pickup_branch_id).toBe(selectedPickupBranch);
    expect(created?.return_branch_id).not.toBe(created?.pickup_branch_id);
    expect(Number(created?.one_way_fee)).toBe(200);
  });

  test("13 inter-branch transfer workflow is available", async ({ page }) => {
    const { fixture } = readContext();
    await open(page, "/agency/operations");
    await expectText(page, "Planifier le transfert");
    const form = page.locator("form").filter({ hasText: "Planifier le transfert" });
    await expect(form).toBeVisible();
    await form.locator("#vehicle_id").selectOption(fixture.vehicles.transfer);
    const from = await form.locator("#from_branch_id").inputValue();
    const to = await form.locator("#to_branch_id option").evaluateAll((items, source) => items.map((item) => (item as HTMLOptionElement).value).filter((value) => value && value !== source), from);
    expect(to.length).toBeGreaterThan(0);
    await form.locator("#to_branch_id").selectOption(to[0]);
    await form.locator("#planned_departure").fill("2099-05-01T10:00");
    await form.getByRole("button", { name: "Planifier le transfert", exact: true }).click();
    await expectText(page, "Enregistré.");
    await page.reload({ waitUntil: "domcontentloaded" });
    const transfer = (await rows("vehicle_transfers", { vehicle_id: fixture.vehicles.transfer })).sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
    expect(transfer?.status).toBe("PLANNED");
    const transferVehicle = await one("vehicles", { id: fixture.vehicles.transfer });
    const departureMileage = Number(transferVehicle?.mileage ?? 0) + 1;
    const transferId = String(transfer.id);
    const transferCard = page.locator(`form:has(input[name="transfer_id"][value="${transferId}"])`);
    await transferCard.locator("input[name='mileage_departure']").fill(String(departureMileage));
    await transferCard.locator("input[name='fuel_departure']").fill("8");
    await transferCard.getByRole("button", { name: "Démarrer le transfert", exact: true }).click();
    await expect.poll(async () => (await one("vehicle_transfers", { id: transferId }))?.status, { timeout: 10_000 }).toBe("IN_TRANSIT");
    await page.reload({ waitUntil: "domcontentloaded" });
    const inTransit = await one("vehicle_transfers", { id: transferId });
    expect(inTransit?.status).toBe("IN_TRANSIT");
    const arrivalCard = page.locator(`form:has(input[name="transfer_id"][value="${transferId}"])`);
    await arrivalCard.locator("input[name='mileage_arrival']").fill(String(departureMileage + 1));
    await arrivalCard.locator("input[name='fuel_arrival']").fill("7");
    await arrivalCard.getByRole("button", { name: "Confirmer l’arrivée", exact: true }).click();
    await expect.poll(async () => (await one("vehicle_transfers", { id: transferId }))?.status, { timeout: 10_000 }).toBe("COMPLETED");
    const completed = await one("vehicle_transfers", { id: transferId });
    const vehicle = await one("vehicles", { id: fixture.vehicles.transfer });
    expect(completed?.status).toBe("COMPLETED");
    expect(vehicle?.branch_id).toBe(completed?.to_branch_id);
  });

  test("14 early return policy is configurable on contract creation", async ({ page }) => {
    await open(page, "/agency/contracts/new");
    await expect(page.locator("#early_return_policy")).toBeVisible();
    await expect(page.locator("#early_return_policy option[value='PARTIAL_REFUND']")).toHaveCount(1);
  });

  test("15 reservation cancellation is exposed as an operational action", async ({ page }) => {
    const reservationId = await createReservationFromUi(page, "2099-06-01", "2099-06-03");
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await page.locator("#reservation-status-reason").fill("TEST_BROWSER cancellation");
    await page.getByRole("button", { name: "Confirmer", exact: true }).click();
    await expect.poll(async () => (await one("reservations", { id: reservationId }))?.status).toBe("CANCELLED");
  });

  test("16 no-show action is exposed beside reservation status", async ({ page }) => {
    const reservationId = await createReservationFromUi(page, "2099-07-01", "2099-07-03");
    await page.getByRole("button", { name: /Marquer absent/ }).first().click();
    await page.locator("#reservation-status-reason").fill("TEST_BROWSER no-show");
    await page.getByRole("button", { name: "Confirmer", exact: true }).click();
    await expect.poll(async () => (await one("reservations", { id: reservationId }))?.status).toBe("NO_SHOW");
  });

  test("17 fine matching workflow exposes historical contract resolution", async ({ page }) => {
    const { fixture } = readContext();
    await open(page, "/agency/operations");
    await expectText(page, "Contravention à rattacher");
    const historical = await one("contracts", { id: fixture.subleaseContract });
    expect(historical?.vehicle_id).toBeTruthy();
    const form = page.locator("form").filter({ hasText: "Enregistrer la contravention" });
    await form.locator("#vehicle_id").selectOption(String(historical?.vehicle_id));
    await form.locator("#violation_at").fill(`${historical?.start_date}T12:00`);
    await form.locator("#amount").fill("180");
    await form.locator("#reference").fill("TEST_BROWSER-FINE");
    await form.getByRole("button", { name: "Enregistrer la contravention", exact: true }).click();
    await expectText(page, "Enregistré.");
    const fines = await rows("fines", { vehicle_id: String(historical?.vehicle_id) });
    const fine = fines.find((row) => row.reference === "TEST_BROWSER-FINE");
    expect(fine?.contract_id).toBe(fixture.subleaseContract);
    expect(fine?.customer_id).toBe(historical?.customer_id);
  });

  test("18 damage repair workflow reaches garage and repaired states", async ({ page }) => {
    const { fixture } = readContext();
    await open(page, "/agency/operations");
    await expectText(page, "Signaler le dommage");
    const description = `TEST_BROWSER_DAMAGE_${Date.now()}`;
    const damageForm = page.locator("form").filter({ hasText: "Signaler le dommage" });
    await damageForm.locator("#vehicle_id").selectOption(fixture.vehicles.free);
    await damageForm.locator("#body_area").fill("Pare-chocs avant");
    await damageForm.locator("#damage_type").fill("Rayure synthétique");
    await damageForm.locator("#description").fill(description);
    await damageForm.locator("#severity").selectOption("MAJOR");
    await damageForm.locator("#estimated_repair_cost").fill("600");
    await damageForm.getByRole("button", { name: "Signaler le dommage", exact: true }).click();
    await expectText(page, "Enregistré.");
    const damageRows = await rows("damage_records", { vehicle_id: fixture.vehicles.free });
    const damage = damageRows.find((row) => row.description === description);
    expect(damage?.status).toBe("REPORTED");
    await page.reload({ waitUntil: "domcontentloaded" });
    const repairForm = page.locator("form").filter({ hasText: "Mettre à jour la réparation" }).filter({ has: page.locator(`input[name="damage_id"][value="${damage?.id}"]`) });
    await repairForm.locator("select[name='status']").selectOption("REPAIRING");
    await repairForm.locator("input[name='garage_name']").fill("Garage TEST_E2E");
    await repairForm.locator("input[name='final_repair_cost']").fill("550");
    await repairForm.getByRole("button", { name: "Mettre à jour la réparation", exact: true }).click();
    await expectText(page, "Réparation mise à jour.");
    await page.reload({ waitUntil: "domcontentloaded" });
    const repairedForm = page.locator("form").filter({ hasText: "Mettre à jour la réparation" }).filter({ has: page.locator(`input[name="damage_id"][value="${damage?.id}"]`) });
    await repairedForm.locator("select[name='status']").selectOption("REPAIRED");
    await repairedForm.locator("input[name='final_repair_cost']").fill("550");
    await repairedForm.getByRole("button", { name: "Mettre à jour la réparation", exact: true }).click();
    await expectText(page, "Réparation mise à jour.");
    const updated = await one("damage_records", { id: String(damage?.id) });
    const vehicle = await one("vehicles", { id: fixture.vehicles.free });
    expect(updated?.status).toBe("REPAIRED");
    expect(Number(updated?.final_repair_cost)).toBe(550);
    expect(vehicle?.status).toBe("AVAILABLE");
  });

  test("19 Agent cannot open owner-only financial administration", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: readContext().hostedUrl, storageState: agentAuthPath, ...browserContextOptions() });
    const page = await context.newPage();
    try {
      await page.goto("/agency/expenses/new", { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toContainText(/Accès|autorisé|permission/i);
    } finally {
      await context.close();
    }
  });

  test("20 foreign rental URL does not disclose another tenant dossier", async ({ page }) => {
    const { fixture } = readContext();
    expect(fixture.foreign?.contractId).toMatch(/[0-9a-f-]{36}/i);
    await page.goto(`/agency/contracts/${fixture.foreign?.contractId}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText(/introuvable|accès|contrat|not found|This page could not be found/i);
    await expect(page.locator("body")).not.toContainText(/TEST-E2E-FOREIGN|Foreign Client|FOR-/i);
  });

  test("21 branch-limited employee sees branch-scoped operational pages", async ({ browser }) => {
    const { fixture } = readContext();
    const context = await browser.newContext({ baseURL: readContext().hostedUrl, storageState: agentAuthPath, ...browserContextOptions() });
    const page = await context.newPage();
    try {
      await page.goto("/agency/operations", { waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("body")).toContainText("Casablanca");
      await expect(page.locator("body")).not.toContainText("Marrakech");
      await page.goto(`/agency/contracts/${fixture.activeContract}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).not.toContainText("QA-DEMO-CONTRACT-ACTIVE");
      await expect(page.locator("body")).toContainText(/introuvable|accès|autorisé|not found|404/i);
    } finally {
      await context.close();
    }
  });

  test("22 photo upload surface supports retry without hiding the inspection form", async ({ page }) => {
    const { fixture } = readContext();
    await openPhotoContract(page);
    const returnPhotoSection = page.getByText("Photos du retour", { exact: true }).locator("..");
    await expect(returnPhotoSection).toBeVisible();
    const fileInputs = returnPhotoSection.locator("input[type='file']");
    await expect(fileInputs).toHaveCount(6);
    const photoContractId = fixture.photoContract ?? fixture.activeContract;
    const before = await count("contract_inspection_photos", { contract_id: photoContractId });
    await fileInputs.first().setInputFiles({ name: "invalid.txt", mimeType: "text/plain", buffer: Buffer.from("SYNTHETIC_TEST") });
    await fileInputs.first().locator("xpath=..").getByRole("button", { name: "Ajouter", exact: true }).click();
    await expectText(page, "Format accepté");
    expect(await count("contract_inspection_photos", { contract_id: photoContractId })).toBe(before);
    const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    await fileInputs.first().setInputFiles({ name: "front.png", mimeType: "image/png", buffer: onePixelPng });
    await fileInputs.first().locator("xpath=..").getByRole("button", { name: "Ajouter", exact: true }).click();
    await expectText(page, "Photo enregistrée.");
    const photos = await rows("contract_inspection_photos", { contract_id: photoContractId });
    expect(photos.length).toBe(before + 1);
    expect(photos.some((photo) => photo.inspection_type === "RETURN" && photo.content_type === "image/png")).toBe(true);
  });

  test("23 repeated financial submit carries an idempotency key", async ({ page }) => {
    const { fixture } = readContext();
    await open(page, `/agency/payments/new?contract=${fixture.activeContract}`);
    const key = page.locator("input[name='idempotency_key']");
    await expect(key).toHaveCount(1);
    const value = await key.inputValue();
    expect(value).toMatch(/.+/);
    const before = await count("payments", { contract_id: fixture.activeContract });
    await page.locator("#amount").fill("7");
    await page.locator("#method").selectOption("TRANSFER");
    const paymentForm = page.locator("form").filter({ has: page.locator("input[name='idempotency_key']") });
    await paymentForm.evaluate((form) => {
      // Two real browser submissions of the same mounted form carry the same
      // generated idempotency key. The server must collapse them to one row.
      const formElement = form as HTMLFormElement;
      formElement.requestSubmit();
      formElement.requestSubmit();
    });
    await expect(page).toHaveURL(new RegExp(`/agency/contracts/${fixture.activeContract}`));
    const after = await count("payments", { contract_id: fixture.activeContract });
    expect(after).toBe(before + 1);
  });
});
