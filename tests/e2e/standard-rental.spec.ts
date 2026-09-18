import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { one, rows } from "./staging-db";

type Fixture = {
  agency?: { id: string };
  branches?: { casablanca: string; marrakech: string };
  vehicles: Record<string, string>;
};

function context(): { hostedUrl: string; fixture: Fixture } {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "test-results", ".fleethub-e2e", "context.json"), "utf8"));
}

async function sign(page: Page, scope: Locator) {
  const canvas = scope.getByLabel("Zone de signature").first();
  await expect(canvas).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Signature canvas has no bounds");
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2 - 12, { steps: 4 });
  await page.mouse.move(box.x + box.width * 0.66, box.y + box.height / 2 + 12, { steps: 4 });
  await page.mouse.move(box.x + box.width - 30, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => scope.locator("input[name='signature_data']").inputValue()).not.toBe("");
}

async function uploadInspectionPhotos(page: Page, title: string, contractId: string, inspectionType: "PICKUP" | "RETURN") {
  const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const section = page.getByText(title, { exact: true }).locator("..");
  const inputs = section.locator("input[type='file']");
  await expect(inputs).toHaveCount(6);
  const expectedTypes = ["FRONT", "REAR", "LEFT", "RIGHT", "INTERIOR", "DASHBOARD"];
  for (let index = 0; index < expectedTypes.length; index += 1) {
    const form = inputs.nth(index).locator("xpath=..");
    await inputs.nth(index).setInputFiles({ name: `${inspectionType.toLowerCase()}-${index}.png`, mimeType: "image/png", buffer: onePixelPng });
    await form.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(form.getByText("Photo enregistrée.", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect.poll(async () => {
      const photos = await rows("contract_inspection_photos", { contract_id: contractId, inspection_type: inspectionType });
      return photos.filter((photo) => photo.photo_type === expectedTypes[index]).length;
    // Keep this a persisted-storage assertion while allowing the measured
    // hosted cold-start/transport window for photo uploads.
    }, { timeout: 60_000 }).toBe(1);
  }
}

async function open(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();
}

test("standard rental is executed through the browser and reconciles in staging", async ({ page }) => {
  test.setTimeout(300_000);
  const { fixture } = context();
  const vehicleId = fixture.vehicles.free;
  if (!vehicleId) throw new Error("Synthetic free vehicle fixture is required");

  // Reservation and advance are created through their real staff forms.
  await open(page, "/agency/reservations/new");
  await page.locator("#customer_id").selectOption({ index: 1 });
  await page.locator("#vehicle_id").selectOption(vehicleId);
  await page.locator("#start_date").fill("2099-11-01");
  await page.locator("#end_date").fill("2099-11-03");
  await page.locator("#pickup_location").fill("Casablanca — test staging");
  await page.locator("#return_location").fill("Casablanca — test staging");
  await page.locator("#deposit_amount").fill("3000");
  await page.locator("#advance_amount").fill("300");
  await page.locator("#notes").fill("TEST_E2E standard rental");
  await page.getByRole("button", { name: "Créer la réservation", exact: true }).click();
  await expect(page.getByText("Réservation créée", { exact: true })).toBeVisible();
  const reservationHref = await page.getByRole("link", { name: "Ouvrir la réservation", exact: true }).getAttribute("href");
  if (!reservationHref) throw new Error("Reservation detail link missing");
  await page.goto(reservationHref, { waitUntil: "domcontentloaded" });
  const reservationId = new URL(page.url()).pathname.split("/").pop()!;
  const reservation = await one("reservations", { id: reservationId });
  expect(reservation?.vehicle_id).toBe(vehicleId);

  // Add the configured baby-seat extra before contract generation.
  const extraForm = page.locator("form").filter({ has: page.locator("#reservation-extra-id") });
  await expect(extraForm).toBeVisible();
  const extraOptions = await extraForm.locator("#reservation-extra-id option").evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value).filter(Boolean));
  expect(extraOptions.length).toBeGreaterThan(0);
  await extraForm.locator("#reservation-extra-id").selectOption(extraOptions[0]);
  await extraForm.locator("#reservation-extra-qty").fill("1");
  await extraForm.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect.poll(async () => (await rows("reservation_extras", { reservation_id: reservationId })).length).toBe(1);

  await open(page, `/agency/payments/new?reservation=${reservationId}`);
  await page.locator("#amount").fill("300");
  await page.locator("#type").selectOption("RENTAL");
  await page.locator("#method").selectOption("TRANSFER");
  await page.locator("#reference").fill("TEST_E2E-ADVANCE");
  await page.getByRole("button", { name: "Enregistrer le paiement", exact: true }).click();
  // The browser action is the source of truth; hosted Server Action redirects
  // can be delayed or aborted after the commit. Verify the persisted payment
  // and then navigate explicitly to the next dossier step.
  await expect.poll(async () => {
    const payments = await rows("payments", { reservation_id: reservationId });
    return payments.some((payment) => Number(payment.amount) === 300 && payment.type === "RENTAL");
  }, { timeout: 60_000 }).toBe(true);

  // Generate a bilingual contract from the reservation and activate it.
  await open(page, `/agency/contracts/new?reservation=${reservationId}`);
  await page.locator("#vehicle_id").selectOption(vehicleId);
  await page.locator("#start_mileage").fill("33000");
  await page.locator("#fuel_level_start").fill("8");
  await page.locator("#daily_rate").fill("280");
  await page.locator("#total_amount").fill("840");
  await page.locator("#deposit_amount").fill("3000");
  await page.locator("#contract_language").selectOption("BILINGUAL");
  await page.locator("#terms_ar").fill("شروط تركيبية للاختبار TEST_E2E");
  await page.locator("#early_return_policy").selectOption("NO_REFUND");
  await page.getByRole("button", { name: "Créer le contrat", exact: true }).click();
  await expect(page.getByText("Contrat créé", { exact: true })).toBeVisible();
  const contractHref = await page.getByRole("link", { name: "Ouvrir le contrat", exact: true }).getAttribute("href");
  if (!contractHref) throw new Error("Contract detail link missing");
  await page.goto(contractHref, { waitUntil: "domcontentloaded" });
  const contractId = new URL(page.url()).pathname.split("/").pop()!;
  const draft = await one("contracts", { id: contractId });
  expect(draft?.status).toBe("DRAFT");
  expect(draft?.contract_language).toBe("BILINGUAL");
  expect((await rows("contract_extras", { contract_id: contractId })).length).toBe(1);

  await page.getByRole("button", { name: "Démarrer la location", exact: true }).click();
  await expect.poll(async () => (await one("contracts", { id: contractId }))?.status).toBe("ACTIVE");
  await page.reload({ waitUntil: "domcontentloaded" });

  // Preparation must be complete before the handover.
  const preparation = page.locator("#preparation form");
  await preparation.locator("input[type='checkbox']").evaluateAll((items) => items.forEach((item) => (item as HTMLInputElement).click()));
  await preparation.locator("#keys_count").fill("2");
  await preparation.getByRole("button", { name: "Enregistrer la préparation", exact: true }).click();
  await expect.poll(async () => (await one("vehicle_preparations", { contract_id: contractId }))?.status).toBe("READY");
  await page.reload({ waitUntil: "domcontentloaded" });

  // Checkout, signature, and all six departure photos.
  const checkout = page.locator("#check-out form");
  await checkout.locator("#checkout_at").fill("2099-11-01T10:00");
  await checkout.locator("#checkout_mileage").fill("33000");
  await checkout.locator("#checkout_fuel").fill("8");
  await checkout.locator("#checkout_signature").fill("Client TEST_E2E");
  await sign(page, checkout);
  await checkout.getByRole("button", { name: "Valider le check-out", exact: true }).click();
  await expect.poll(async () => (await one("contract_checkouts", { contract_id: contractId }))?.mileage).toBe(33000);
  // Use a fresh document request after the server action so the return panel
  // cannot be satisfied by a stale RSC payload.
  await page.goto(`/agency/contracts/${contractId}?after-checkout=${Date.now()}`, { waitUntil: "domcontentloaded" });
  await uploadInspectionPhotos(page, "Photos de départ", contractId, "PICKUP");

  // Receive the caution through the contract's dedicated workflow.
  await page.goto(`/agency/contracts/${contractId}?after-return-review=${Date.now()}`, { waitUntil: "domcontentloaded" });
  const depositId = (await one("deposits", { contract_id: contractId }))?.id as string;
  const depositForm = page.locator("#caution form");
  await depositForm.locator("#transaction_type").selectOption("RECEIVED");
  await depositForm.locator("#deposit_amount_tx").fill("3000");
  await depositForm.locator("#deposit_reason").fill("TEST_E2E caution reçue");
  await depositForm.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect.poll(async () => (await one("deposits", { id: depositId }))?.status).toBe("HELD");

  // A second payment is recorded before the return.
  await open(page, `/agency/payments/new?contract=${contractId}`);
  await page.locator("#amount").fill("300");
  await page.locator("#type").selectOption("RENTAL");
  await page.locator("#method").selectOption("CARD");
  await page.locator("#reference").fill("TEST_E2E-CARD");
  await page.getByRole("button", { name: "Enregistrer le paiement", exact: true }).click();
  await expect.poll(async () => {
    const payments = await rows("payments", { contract_id: contractId });
    return payments.some((payment) => Number(payment.amount) === 300 && payment.reference === "TEST_E2E-CARD");
  }, { timeout: 60_000 }).toBe(true);

  // Check-in is reviewed, photographed, and only then finalized.
  await page.goto(`/agency/contracts/${contractId}?after-payment=${Date.now()}`, { waitUntil: "domcontentloaded" });
  const checkin = page.locator("#check-in form");
  await checkin.locator("#return-at").fill("2099-11-04T12:00");
  await checkin.locator("#return-mileage").fill("33500");
  await checkin.locator("#return-fuel").fill("8");
  await checkin.locator("#signature-name").fill("Client TEST_E2E");
  await sign(page, checkin);
  await checkin.getByRole("button", { name: "Enregistrer et revoir", exact: true }).click();
  await expect.poll(async () => (await one("contract_checkins", { contract_id: contractId }))?.status).toBe("REVIEW");
  await uploadInspectionPhotos(page, "Photos du retour", contractId, "RETURN");
  // Keep the review form mounted while photos upload. A fresh document would
  // intentionally start a new review draft, whereas this mounted action
  // contains the validated fields needed for finalization.
  const review = page.locator("#check-in form");
  await review.locator("input[name='review_confirmed']").check();
  await review.getByRole("button", { name: "Finaliser le retour", exact: true }).click();
  await expect.poll(async () => (await one("contract_checkins", { contract_id: contractId }))?.status).toBe("FINALIZED");
  expect((await rows("return_charges", { contract_id: contractId })).some((charge) => charge.charge_type === "LATE_RETURN")).toBe(true);

  // Record a real damage and its private photo from the operations screen.
  await open(page, "/agency/operations");
  const damageForm = page.locator("form").filter({ hasText: "Signaler le dommage" });
  await damageForm.locator("#vehicle_id").selectOption(vehicleId);
  await damageForm.locator("#customer_id").selectOption({ index: 1 });
  await damageForm.locator("#contract_id").selectOption(contractId);
  await damageForm.locator("#body_area").fill("Pare-chocs avant");
  await damageForm.locator("#damage_type").fill("Rayure TEST_E2E");
  await damageForm.locator("#description").fill("Dommage synthétique du scénario standard");
  // Keep this acceptance rental available after settlement; blocking damage
  // is covered by the dedicated damage/repair scenario. The damage itself,
  // private photo and caution deduction remain fully exercised here.
  await damageForm.locator("#severity").selectOption("MINOR");
  await damageForm.locator("#estimated_repair_cost").fill("500");
  await damageForm.getByRole("button", { name: "Signaler le dommage", exact: true }).click();
  await expect.poll(async () => (await rows("damage_records", { contract_id: contractId })).length).toBe(1);
  await page.reload({ waitUntil: "domcontentloaded" });
  const damageCard = page.getByText("Dommage synthétique du scénario standard", { exact: true }).locator("..");
  const damagePhoto = damageCard.locator("input[type='file']");
  await damagePhoto.setInputFiles({ name: "damage-test-e2e.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
  await damageCard.getByRole("button", { name: "Photo", exact: true }).click();
  const damage = (await rows("damage_records", { contract_id: contractId }))[0];
  const damageId = String(damage.id);
  await expect.poll(async () => (await rows("damage_photos", { damage_id: damageId })).length).toBe(1);

  // Deduct 500 MAD from the held caution, pay the exact remaining balance,
  // issue both financial documents, and close the rental.
  await open(page, `/agency/contracts/${contractId}`);
  const deductionForm = page.locator("#caution form");
  await deductionForm.locator("#transaction_type").selectOption("DEDUCTION");
  await deductionForm.locator("#deposit_amount_tx").fill("500");
  await deductionForm.locator("#deposit_reason").fill("Dommage TEST_E2E");
  await deductionForm.getByRole("button", { name: "Enregistrer", exact: true }).click();
  // Hosted staging can take several seconds for the authenticated audit write
  // and deposit trigger; keep the assertion bounded without treating a slow
  // but successful financial confirmation as a transport failure.
  await expect(deductionForm.getByText("Opération de caution enregistrée.", { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => {
    const transactions = await rows("deposit_transactions", { deposit_id: depositId, transaction_type: "DEDUCTION" });
    return transactions.some((transaction) => Number(transaction.amount) === 500);
  }, { timeout: 15_000 }).toBe(true);

  const contract = await one("contracts", { id: contractId });
  const charges = await rows("return_charges", { contract_id: contractId });
  const contractPayments = await rows("payments", { contract_id: contractId });
  const depositTransactions = await rows("deposit_transactions", { deposit_id: depositId });
  const grossTotal = Number(contract?.base_total_amount ?? 0) + Number(contract?.extras_total ?? 0) + Number(contract?.one_way_fee ?? 0) + charges.reduce((sum, charge) => sum + Number(charge.amount), 0);
  const paid = contractPayments.filter((payment) => payment.status === "COMPLETED" && ["RENTAL", "PENALTY", "EXTRA"].includes(String(payment.type))).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const settledByDeposit = depositTransactions.filter((tx) => tx.transaction_type === "DEDUCTION" && tx.settles_balance === true).reduce((sum, tx) => sum + Number(tx.amount), 0);
  const amountDue = Math.max(0, Math.round((grossTotal - paid - settledByDeposit) * 100) / 100);
  expect(amountDue).toBeGreaterThan(0);

  await open(page, `/agency/payments/new?contract=${contractId}`);
  await page.locator("#amount").fill(amountDue.toFixed(2));
  await page.locator("#type").selectOption("RENTAL");
  await page.locator("#method").selectOption("TRANSFER");
  await page.locator("#reference").fill("TEST_E2E-SOLDE");
  await page.getByRole("button", { name: "Enregistrer le paiement", exact: true }).click();
  await expect.poll(async () => {
    const payments = await rows("payments", { contract_id: contractId });
    return payments.some((payment) => Number(payment.amount) === amountDue && payment.reference === "TEST_E2E-SOLDE");
  }, { timeout: 60_000 }).toBe(true);
  // Request a fresh contract document after the redirect. A payment action
  // revalidates the contract route, but a browser reload can race that RSC
  // response and leave the payment form mounted in the test document.
  await page.goto(`/agency/contracts/${contractId}?after-final-payment=${Date.now()}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#caution")).toBeVisible();

  const refundForm = page.locator("#caution form");
  await refundForm.locator("#transaction_type").selectOption("REFUND");
  await refundForm.locator("#deposit_amount_tx").fill("2500");
  await refundForm.locator("#deposit_reason").fill("Reliquat caution TEST_E2E");
  await refundForm.getByRole("button", { name: "Enregistrer", exact: true }).click();
  // The server action commits the deposit row and its trigger update in one
  // transaction.  The staging API can take a few seconds to expose the
  // committed row after the action returns, so wait on both the transaction
  // and the derived lifecycle state rather than treating a brief read-after-
  // write lag as a financial failure.
  await expect.poll(async () => {
    const refundRows = await rows("deposit_transactions", { deposit_id: depositId, transaction_type: "REFUND" });
    const deposit = await one("deposits", { id: depositId });
    return refundRows.some((row) => Number(row.amount) === 2500) && deposit?.status === "REFUNDED";
  }, { timeout: 15_000 }).toBe(true);

  await page.getByRole("button", { name: "Émettre la facture", exact: true }).click();
  await expect.poll(async () => (await rows("invoices", { contract_id: contractId })).some((invoice) => invoice.kind === "INVOICE" && invoice.status === "ISSUED")).toBe(true);
  await expect(page.getByRole("button", { name: "Reçu", exact: true })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Reçu", exact: true }).click();
  await expect.poll(async () => (await rows("invoices", { contract_id: contractId })).some((invoice) => invoice.kind === "RECEIPT" && invoice.status === "ISSUED"), { timeout: 30_000 }).toBe(true);
  const receipt = (await rows("invoices", { contract_id: contractId })).find((invoice) => invoice.kind === "RECEIPT" && invoice.status === "ISSUED");
  if (!receipt) throw new Error("Receipt was not persisted after the browser action");
  await page.goto(`/agency/contracts/${contractId}/invoice/${receipt.id}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Reçu", { exact: true }).first()).toBeVisible();
  await page.goto(`/agency/contracts/${contractId}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Clôturer le contrat", exact: true }).click();
  await page.locator("#end_mileage").fill("33500");
  await page.locator("#fuel_level_end").fill("8");
  await page.getByRole("button", { name: "Confirmer la clôture", exact: true }).click();
  await expect.poll(async () => (await one("contracts", { id: contractId }))?.status).toBe("CLOSED");
  const finalVehicle = await one("vehicles", { id: vehicleId });
  expect(finalVehicle?.status).toBe("AVAILABLE");
  expect(finalVehicle?.mileage).toBe(33500);
  const finalInvoices = await rows("invoices", { contract_id: contractId });
  expect(finalInvoices.some((invoice) => invoice.kind === "INVOICE" && invoice.status === "ISSUED")).toBe(true);
  expect(finalInvoices.some((invoice) => invoice.kind === "RECEIPT" && invoice.status === "ISSUED")).toBe(true);
});
