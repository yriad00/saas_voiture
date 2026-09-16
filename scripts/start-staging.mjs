import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const root = process.cwd();
const productionRef = "wewajfotwphufsthfgul";
const stagingRef = "nyurwczpxpcpwqamfoek";

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

const fileEnv = readEnvFile(path.join(root, ".env.test.local"));
const supabaseUrl = process.env.FLEETHUB_TEST_SUPABASE_URL ?? fileEnv.FLEETHUB_TEST_SUPABASE_URL;
const anonKey = process.env.FLEETHUB_TEST_SUPABASE_ANON_KEY ?? fileEnv.FLEETHUB_TEST_SUPABASE_ANON_KEY;
if (!supabaseUrl || !anonKey) throw new Error("Staging E2E requires .env.test.local Supabase URL and anon key.");
if (!supabaseUrl.includes(stagingRef) || supabaseUrl.includes(productionRef)) {
  throw new Error("Refusing to start the local E2E server: Supabase target is not fleethub-staging.");
}

const port = String(process.env.FLEETHUB_LOCAL_PORT ?? process.env.PORT ?? "3200");
const stagingEnv = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  PORT: port,
};

// Build with staging public variables before starting Next. This prevents the
// production values from .env.local being inlined into the client bundle.
const build = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  cwd: root,
  env: stagingEnv,
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", port], {
  cwd: root,
  env: stagingEnv,
  stdio: "inherit",
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
child.on("error", (error) => {
  console.error(`Unable to start staging server: ${error.message}`);
  process.exit(1);
});
