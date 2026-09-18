import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

type E2EContext = { fixture: { reservation: string; activeContract: string } };

test("hosted staging route performance baseline", async ({ page }) => {
  const context = JSON.parse(fs.readFileSync(path.join(process.cwd(), "test-results", ".fleethub-e2e", "context.json"), "utf8")) as E2EContext;
  const routes = [
    ["Aujourd’hui", "/agency/today"],
    ["Réservations", "/agency/reservations"],
    ["Reservation detail", `/agency/reservations/${context.fixture.reservation}`],
    ["Nouvelle réservation", "/agency/reservations/new"],
    ["Clients", "/agency/customers"],
    ["Véhicules", "/agency/fleet"],
    ["Locations", "/agency/contracts"],
    ["Contract detail", `/agency/contracts/${context.fixture.activeContract}`],
    ["Payment", `/agency/payments/new?contract=${context.fixture.activeContract}`],
    ["Caisse", "/agency/caisse"],
    ["Operations", "/agency/operations"],
  ] as const;
  const measurements: Record<string, number> = {};
  let contractCriticalMs: number | null = null;
  let contractFullMs: number | null = null;
  for (const [name, route] of routes) {
    const started = Date.now();
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();
    if (name === "Contract detail") {
      await expect(page.getByTestId("contract-critical")).toBeVisible();
      contractCriticalMs = Date.now() - started;
      await expect(page.locator("#finances")).toBeVisible();
      contractFullMs = Date.now() - started;
    }
    measurements[name] = Date.now() - started;
  }
  const report = { baseURL: process.env.FLEETHUB_HOSTED_URL ?? process.env.FLEETHUB_LOCAL_URL ?? null, measurements, contractCriticalMs, contractFullMs };
  console.log(`E2E_PERFORMANCE ${JSON.stringify(report)}`);
  fs.writeFileSync(path.join(process.cwd(), "test-results", "hosted-performance.json"), JSON.stringify(report, null, 2));
});
