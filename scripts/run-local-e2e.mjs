import { spawn } from "node:child_process";
import crypto from "node:crypto";

const e2eIp = process.env.FLEETHUB_E2E_IP ?? `198.18.${crypto.randomInt(1, 255)}.${crypto.randomInt(1, 255)}`;
const env = { ...process.env, FLEETHUB_LOCAL_E2E: "1", FLEETHUB_LOCAL_URL: process.env.FLEETHUB_LOCAL_URL ?? "http://127.0.0.1:3200", FLEETHUB_E2E_IP: e2eIp };
const child = spawn(process.execPath, ["--env-file=.env.test.local", "./node_modules/@playwright/test/cli.js", "test", "tests/e2e", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
child.on("error", (error) => {
  console.error(`Unable to start Playwright: ${error.message}`);
  process.exit(1);
});
