import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { assertStagingTarget } from "../../scripts/staging-target.mjs";

const root = process.cwd();
const resultsDir = path.join(root, "test-results");
const e2eDir = path.join(resultsDir, ".fleethub-e2e");
const contextPath = path.join(e2eDir, "context.json");
const authPath = path.join(e2eDir, "owner-storage.json");
const agentAuthPath = path.join(e2eDir, "agent-storage.json");

function readEnvFile(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) values[match[1]] = match[2].replace(/^"|"$/g, "");
  }
  return values;
}

function assertHostedUrl() {
  const localRun = process.env.FLEETHUB_LOCAL_E2E === "1";
  const value = localRun ? (process.env.FLEETHUB_LOCAL_URL || "http://127.0.0.1:3200") : process.env.FLEETHUB_HOSTED_URL;
  if (!value) throw new Error("FLEETHUB_HOSTED_URL is required; refusing to run release E2E without a hosted target.");
  const url = new URL(value);
  if (!localRun && ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw new Error("FLEETHUB_HOSTED_URL must be hosted, not localhost.");
  if (!localRun && url.protocol !== "https:") throw new Error("FLEETHUB_HOSTED_URL must use HTTPS.");
  return url.toString().replace(/\/$/, "");
}

function runSeed(testEnv) {
  const result = spawnSync(process.execPath, ["scripts/seed-demo-agency.mjs"], {
    cwd: root,
    env: { ...process.env, ...testEnv },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) throw new Error(`staging seed failed:\n${result.stderr || result.stdout}`);
  const line = result.stdout.split(/\r?\n/).reverse().find((item) => item.trim().startsWith("{") && item.includes('"agency"'));
  if (!line) throw new Error(`staging seed did not return fixture context:\n${result.stdout}`);
  return JSON.parse(line);
}

function cleanupAfterSeedFailure(testEnv) {
  spawnSync(process.execPath, ["scripts/reset-demo-agency.mjs"], {
    cwd: root,
    env: { ...process.env, ...testEnv },
    encoding: "utf8",
    stdio: "ignore",
  });
}

export default async function globalSetup() {
  const hostedUrl = assertHostedUrl();
  const e2eRunId = `E2E_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const e2eIp = process.env.FLEETHUB_E2E_IP || `198.18.${crypto.randomInt(1, 255)}.${crypto.randomInt(1, 255)}`;
  const testEnv = {
    ...readEnvFile(path.join(root, ".env.test.local")),
    // Every browser run receives a fresh tenant. Never reset the Manual QA
    // Demo Agency while exercising release workflows.
    FLEETHUB_E2E_RUN_ID: e2eRunId,
    FLEETHUB_E2E_IP: e2eIp,
  };
  const supabaseUrl = testEnv.FLEETHUB_TEST_SUPABASE_URL;
  assertStagingTarget(supabaseUrl, "FLEETHUB_TEST_SUPABASE_URL");
  if (!testEnv.FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY) throw new Error("FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY is required for isolated staging fixtures.");

  fs.mkdirSync(e2eDir, { recursive: true });
  let fixture;
  try {
    fixture = runSeed(testEnv);
  } catch (error) {
    cleanupAfterSeedFailure(testEnv);
    throw error;
  }
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL: hostedUrl, extraHTTPHeaders: { "x-forwarded-for": e2eIp } });
    const page = await context.newPage();
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Email", { exact: true }).fill(fixture.owner.email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(fixture.owner.password);
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    // Hosted Vercel can queue a cold serverless auth action before the
    // redirect is observable by the browser. Keep the assertion strict while
    // allowing the measured staging transport window.
    await page.waitForURL(/\/agency(?:\/|$)/, { timeout: 60_000 });
    await context.storageState({ path: authPath });
    // Authenticate the branch-limited employee once during setup. The tests
    // reuse this browser state so repeated suites do not trip the real Auth
    // provider's IP throttling while still exercising the UI as an Agent.
    const agentContext = await browser.newContext({ baseURL: hostedUrl, extraHTTPHeaders: { "x-forwarded-for": e2eIp } });
    const agentPage = await agentContext.newPage();
    await agentPage.goto("/login", { waitUntil: "domcontentloaded" });
    await agentPage.getByLabel("Email", { exact: true }).fill(fixture.agent.email);
    await agentPage.getByLabel("Mot de passe", { exact: true }).fill(fixture.agent.password);
    await agentPage.getByRole("button", { name: "Se connecter", exact: true }).click();
    await agentPage.waitForURL(/\/agency(?:\/|$)/, { timeout: 60_000 });
    await agentContext.storageState({ path: agentAuthPath });
    await agentContext.close();
    fs.writeFileSync(contextPath, JSON.stringify({ hostedUrl, fixture, e2eRunId: testEnv.FLEETHUB_E2E_RUN_ID, e2eIp }, null, 2), { encoding: "utf8", mode: 0o600 });
  } catch (error) {
    // The teardown still receives the fixture through this file if seeding completed.
    fs.writeFileSync(contextPath, JSON.stringify({ hostedUrl, fixture, e2eRunId: testEnv.FLEETHUB_E2E_RUN_ID, e2eIp }, null, 2), { encoding: "utf8", mode: 0o600 });
    throw error;
  } finally {
    await browser.close();
  }
}

export { contextPath };
