import { test } from "node:test";
import assert from "node:assert/strict";
import { assertStagingTarget, STAGING_SUPABASE_HOSTNAME } from "../scripts/staging-target.mjs";

test("staging guard accepts only the exact HTTPS Supabase hostname", () => {
  const url = assertStagingTarget(`https://${STAGING_SUPABASE_HOSTNAME}`);
  assert.equal(url.hostname, STAGING_SUPABASE_HOSTNAME);
});

test("staging guard rejects production and lookalike hosts", () => {
  for (const value of [
    "https://wewajfotwphufsthfgul.supabase.co",
    "https://nyurwczpxpcpwqamfoek.supabase.co.attacker.invalid",
    "https://nyurwczpxpcpwqamfoek.supabase.co.evil.test",
    "http://nyurwczpxpcpwqamfoek.supabase.co",
    `https:user:pass@${STAGING_SUPABASE_HOSTNAME}`,
  ]) {
    assert.throws(() => assertStagingTarget(value));
  }
});
