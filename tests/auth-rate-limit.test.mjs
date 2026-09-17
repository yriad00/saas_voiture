import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { assertStagingTarget } from "../scripts/staging-target.mjs";

function readEnv() {
  const values = {};
  for (const line of fs.readFileSync(".env.test.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

const env = readEnv();
const url = env.FLEETHUB_TEST_SUPABASE_URL;
const anonKey = env.FLEETHUB_TEST_SUPABASE_ANON_KEY;
const serviceKey = env.FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && anonKey && serviceKey, "staging test credentials are required");
assertStagingTarget(url, "FLEETHUB_TEST_SUPABASE_URL");

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

test("anonymous login limiter blocks repeated attempts by IP and email", async () => {
  const marker = "TEST_RATE_" + crypto.randomUUID();
  const ipHash = hash("ip:" + marker);
  const emailHash = hash("email:" + marker.toLowerCase() + "@example.invalid");
  const bucketKeys = ["ip:" + ipHash, "email:" + emailHash];

  try {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const result = await anon.rpc("consume_login_rate_limit", {
        p_ip_hash: ipHash,
        p_email_hash: emailHash,
        p_limit: 5,
        p_window_seconds: 600,
      });
      assert.ifError(result.error);
      assert.equal(result.data, true, "attempt " + attempt + " should be allowed");
    }

    const blocked = await anon.rpc("consume_login_rate_limit", {
      p_ip_hash: ipHash,
      p_email_hash: emailHash,
      p_limit: 5,
      p_window_seconds: 600,
    });
    assert.ifError(blocked.error);
    assert.equal(blocked.data, false, "sixth attempt should be blocked");
  } finally {
    const cleanup = await admin.from("login_rate_limit_buckets").delete().in("bucket_key", bucketKeys);
    assert.ifError(cleanup.error);
  }
});
