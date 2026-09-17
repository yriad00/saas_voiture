import { defineConfig, devices } from "@playwright/test";

const localRun = process.env.FLEETHUB_LOCAL_E2E === "1";
const hostedRun = !localRun;
const target = localRun ? (process.env.FLEETHUB_LOCAL_URL ?? "http://127.0.0.1:3200") : process.env.FLEETHUB_HOSTED_URL;
if (!target) throw new Error("Set FLEETHUB_HOSTED_URL to the hosted staging URL before running release E2E.");
const parsedUrl = new URL(target);
if (!localRun && ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname)) throw new Error("Release E2E cannot target localhost.");
if (!localRun && parsedUrl.protocol !== "https:") throw new Error("Release E2E requires an HTTPS hosted URL.");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // Hosted Vercel server actions have a measured queue/transport window of
  // roughly 20–45 seconds on a cold invocation. Keep local feedback strict,
  // while allowing hosted assertions to observe the server-confirmed result.
  timeout: hostedRun ? 180_000 : 60_000,
  expect: { timeout: hostedRun ? 60_000 : 10_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/release-e2e.json" }]],
  globalSetup: "./tests/e2e/global-setup.mjs",
  globalTeardown: "./tests/e2e/global-teardown.mjs",
  use: {
    baseURL: parsedUrl.toString().replace(/\/$/, ""),
    ...(process.env.FLEETHUB_E2E_IP ? { extraHTTPHeaders: { "x-forwarded-for": process.env.FLEETHUB_E2E_IP } } : {}),
    storageState: "test-results/.fleethub-e2e/owner-storage.json",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: localRun ? {
    command: "node scripts/start-staging.mjs",
    url: parsedUrl.toString(),
    // Do not reuse a server built with .env.local. Every local release run
    // must compile and serve the staging-targeted bundle above.
    reuseExistingServer: false,
    timeout: 120_000,
  } : undefined,
});
