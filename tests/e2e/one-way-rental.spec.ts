import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { one, rows } from "./staging-db";

type Fixture = {
  agency?: { id: string };
  branches: { casablanca: string; marrakech: string };
  vehicles: Record<string, string>;
};

function context(): { fixture: Fixture } {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "test-results", ".fleethub-e2e", "context.json"), "utf8"));
}

async function open(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();
}

async function sign(page: Page, scope: Locator) {
  const canvas = scope.getByLabel("Zone de signature").first();
  await expect(canvas).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Signature canvas has no bounds");
  await page.mouse.move(box.x + 24, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height / 2 - 10, { steps: 4 });
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2 + 10, { steps: 4 });
  await page.mouse.move(box.x + box.width - 24, box.y + box.height / 2);
  await page.mouse.up();
  await expect.poll(async () => scope.locator("input[name='signature_data']").inputValue()).not.toBe("");
}

async function uploadPhotos(page: Page, title: string, contractId: string, inspectionType: "PICKUP" | "RETURN") {
  const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const section = page.getByText(title, { exact: true }).locator("..");
  const inputs = section.locator("input[type='file']");
  await expect(inputs).toHaveCount(6);
  const types = ["FRONT", "REAR", "LEFT", "RIGHT", "INTERIOR", "DASHBOARD"];
  for (let index = 0; index < types.length; index += 1) {
    const form = inputs.nth(index).locator("xpath=..");
    await inputs.nth(index).setInputFiles({ name: `${inspectionType.toLowerCase()}-one-way-${index}.png`, mimeType: "image/png", buffer: onePixelPng });
    await form.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect.poll(async () => {
      const photos = await rows("contract_inspection_photos", { contract_id: contractId, inspection_type: inspectionType });
      return photos.filter((photo) => photo.photo_type === types[index]).length;
    // Hosted staging may queue the first Storage/server-action invocation for
    // the same measured cold-start window as other mutations. Assert the
    // persisted row, but allow that transport window to complete.
    }, { timeout: 60_000 }).toBe(1);
  }
}

test("one-way rental completes from Casablanca pickup to Marrakech return in the browser", async ({ page }) => {
  test.setTimeout(180_000);
  const { fixture } = context();
  // Keep this scenario isolated from the release matrix's reservation and
  // damage vehicles. The dedicated synthetic vehicle is free in this period.
  const vehicleId = fixture.vehicles.oneWay ?? fixture.vehicles.owned ?? fixture.vehicles.free;
  if (!vehicleId) throw new Error("A free synthetic vehicle is required for the one-way browser scenario");
  if (!fixture.branches?.casablanca || !fixture.branches?.marrakech) throw new Error("Both synthetic branches are required");

  // Create the one-way booking through the real reservation form. The exact
  // vehicle is deliberately reused only in a distinct, isolated period.
  await open(page, "/agency/reservations/new");
  await page.locator("#customer_id").selectOption({ index: 1 });
  await page.locator("#vehicle_id").selectOption({ value: vehicleId });
  await expect(page.locator("#vehicle_id")).toHaveValue(vehicleId);
  await page.locator("#pickup_branch_id").selectOption(fixture.branches.casablanca);
  await page.locator("#return_branch_id").selectOption(fixture.branches.marrakech);
  await page.locator("#start_date").fill("2099-12-01");
  await page.locator("#end_date").fill("2099-12-03");
  await page.locator("#pickup_time").fill("10:00");
  await page.locator("#return_time").fill("10:00");
  await page.locator("#pickup_location").fill("Agence Casablanca — TEST_E2E");
  await page.locator("#return_location").fill("Agence Marrakech — TEST_E2E");
  await page.locator("#one_way_fee").fill("200");
  await page.locator("#daily_rate").fill("280");
  await page.locator("#deposit_amount").fill("3000");
  await page.locator("#notes").fill("TEST_E2E one-way Casablanca → Marrakech");
  await page.getByRole("button", { name: "Créer la réservation", exact: true }).click();
  await expect(page.getByText("Réservation créée", { exact: true })).toBeVisible();
  const reservationHref = await page.getByRole("link", { name: "Ouvrir la réservation", exact: true }).getAttribute("href");
  if (!reservationHref) throw new Error("One-way reservation link missing");
  await page.goto(reservationHref, { waitUntil: "domcontentloaded" });
  const reservationId = new URL(page.url()).pathname.split("/").pop()!;
  const reservation = await one("reservations", { id: reservationId });
  expect(reservation?.pickup_branch_id).toBe(fixture.branches.casablanca);
  expect(reservation?.return_branch_id).toBe(fixture.branches.marrakech);
  expect(Number(reservation?.one_way_fee)).toBe(200);

  // Generate and activate a contract from that reservation, preserving the
  // two branch locations in the server action's reservation snapshot.
  await open(page, `/agency/contracts/new?reservation=${reservationId}`);
  await page.locator("#vehicle_id").selectOption(vehicleId);
  await page.locator("#start_mileage").fill("41000");
  await page.locator("#fuel_level_start").fill("8");
  await page.locator("#daily_rate").fill("280");
  await page.locator("#total_amount").fill("560");
  await page.locator("#deposit_amount").fill("3000");
  await page.locator("#one_way_fee").fill("200");
  await page.locator("#contract_language").selectOption("BILINGUAL");
  await page.locator("#terms_ar").fill("شروط رحلة ذهاب فقط تركيبية TEST_E2E");
  await page.getByRole("button", { name: "Créer le contrat", exact: true }).click();
  await expect(page.getByText("Contrat créé", { exact: true })).toBeVisible();
  const contractHref = await page.getByRole("link", { name: "Ouvrir le contrat", exact: true }).getAttribute("href");
  if (!contractHref) throw new Error("One-way contract link missing");
  await page.goto(contractHref, { waitUntil: "domcontentloaded" });
  const contractId = new URL(page.url()).pathname.split("/").pop()!;
  const draft = await one("contracts", { id: contractId });
  expect(draft?.branch_id).toBe(fixture.branches.casablanca);
  expect(draft?.return_branch_id).toBe(fixture.branches.marrakech);
  expect(Number(draft?.one_way_fee)).toBe(200);

  await page.getByRole("button", { name: "Démarrer la location", exact: true }).click();
  await expect.poll(async () => (await one("contracts", { id: contractId }))?.status).toBe("ACTIVE");
  await page.reload({ waitUntil: "domcontentloaded" });

  const preparation = page.locator("#preparation form");
  await preparation.locator("input[type='checkbox']").evaluateAll((items) => items.forEach((item) => (item as HTMLInputElement).click()));
  await preparation.locator("#keys_count").fill("2");
  await preparation.getByRole("button", { name: "Enregistrer la préparation", exact: true }).click();
  await expect.poll(async () => (await one("vehicle_preparations", { contract_id: contractId }))?.status).toBe("READY");
  await page.reload({ waitUntil: "domcontentloaded" });

  // Casablanca departure: real mobile check-out, signature and six photos.
  const checkout = page.locator("#check-out form");
  await checkout.locator("#checkout_at").fill("2099-12-01T10:00");
  await checkout.locator("#checkout_mileage").fill("41000");
  await checkout.locator("#checkout_fuel").fill("8");
  await checkout.locator("#checkout_signature").fill("Client TEST_E2E One-way");
  await sign(page, checkout);
  await checkout.getByRole("button", { name: "Valider le check-out", exact: true }).click();
  await expect.poll(async () => (await one("contract_checkouts", { contract_id: contractId }))?.mileage).toBe(41000);
  await page.goto(`/agency/contracts/${contractId}?one-way-checkout=${Date.now()}`, { waitUntil: "domcontentloaded" });
  await uploadPhotos(page, "Photos de départ", contractId, "PICKUP");

  // Deposit receipt is required before closure and is kept separate from
  // rental revenue. The full deposit is returned after this clean test.
  const depositId = String((await one("deposits", { contract_id: contractId }))?.id ?? "");
  expect(depositId).toBeTruthy();
  const depositForm = page.locator("#caution form");
  await depositForm.locator("#transaction_type").selectOption("RECEIVED");
  await depositForm.locator("#deposit_amount_tx").fill("3000");
  await depositForm.locator("#deposit_reason").fill("TEST_E2E caution one-way reçue");
  await depositForm.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect.poll(async () => (await one("deposits", { id: depositId }))?.status).toBe("HELD");

  // Marrakech return: the owner is branch-global, so this exercises the
  // destination-branch permission path without bypassing the UI.
  await page.goto(`/agency/contracts/${contractId}?one-way-return=${Date.now()}`, { waitUntil: "domcontentloaded" });
  const checkin = page.locator("#check-in form");
  await expect(page.locator("#return-branch")).toBeVisible();
  await page.locator("#return-branch").selectOption(fixture.branches.marrakech);
  await checkin.locator("#return-at").fill("2099-12-03T10:00");
  await checkin.locator("#return-mileage").fill("41450");
  await checkin.locator("#return-fuel").fill("8");
  await checkin.locator("#signature-name").fill("Client TEST_E2E One-way");
  await sign(page, checkin);
  await checkin.getByRole("button", { name: "Enregistrer et revoir", exact: true }).click();
  await expect.poll(async () => (await one("contract_checkins", { contract_id: contractId }))?.status).toBe("REVIEW");
  expect((await one("contract_checkins", { contract_id: contractId }))?.branch_id).toBe(fixture.branches.marrakech);
  await uploadPhotos(page, "Photos du retour", contractId, "RETURN");
  const review = page.locator("#check-in form");
  await review.locator("input[name='review_confirmed']").check();
  await review.getByRole("button", { name: "Finaliser le retour", exact: true }).click();
  await expect.poll(async () => (await one("contract_checkins", { contract_id: contractId }))?.status).toBe("FINALIZED");
  expect((await rows("contract_inspection_photos", { contract_id: contractId, inspection_type: "RETURN" })).length).toBe(6);

  // Pay the exact one-way rental total, refund the held caution, and close.
  await open(page, `/agency/payments/new?contract=${contractId}`);
  await page.locator("#amount").fill("760");
  await page.locator("#type").selectOption("RENTAL");
  await page.locator("#method").selectOption("TRANSFER");
  await page.locator("#reference").fill("TEST_E2E-ONE-WAY-SOLDE");
  await page.getByRole("button", { name: "Enregistrer le paiement", exact: true }).click();
  await page.waitForURL(new RegExp(`/agency/contracts/${contractId}$`), { timeout: 15_000 });
  await page.goto(`/agency/contracts/${contractId}?one-way-settlement=${Date.now()}`, { waitUntil: "domcontentloaded" });
  const refundForm = page.locator("#caution form");
  await refundForm.locator("#transaction_type").selectOption("REFUND");
  await refundForm.locator("#deposit_amount_tx").fill("3000");
  await refundForm.locator("#deposit_reason").fill("TEST_E2E caution one-way remboursée");
  await refundForm.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect.poll(async () => (await one("deposits", { id: depositId }))?.status).toBe("REFUNDED");

  await page.getByRole("button", { name: "Clôturer le contrat", exact: true }).click();
  await page.locator("#end_mileage").fill("41450");
  await page.locator("#fuel_level_end").fill("8");
  await page.getByRole("button", { name: "Confirmer la clôture", exact: true }).click();
  await expect.poll(async () => (await one("contracts", { id: contractId }))?.status).toBe("CLOSED");
  const finalContract = await one("contracts", { id: contractId });
  const finalVehicle = await one("vehicles", { id: vehicleId });
  expect(finalContract?.return_branch_id).toBe(fixture.branches.marrakech);
  expect(finalVehicle?.branch_id).toBe(fixture.branches.marrakech);
  expect(finalVehicle?.status).toBe("AVAILABLE");
  expect(finalVehicle?.mileage).toBe(41450);
  expect(await rows("contract_checkouts", { contract_id: contractId })).toHaveLength(1);
  expect(await rows("contract_checkins", { contract_id: contractId })).toHaveLength(1);
  expect((await rows("vehicle_transfers", { vehicle_id: vehicleId, status: "IN_TRANSIT" })).length).toBe(0);
});
