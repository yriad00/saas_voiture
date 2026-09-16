import "server-only";

import { createHash } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Brute-force protection for anonymous login attempts.
 * Only one-way hashes reach Postgres; the raw IP and email are never persisted.
 */
export async function consumeLoginRateLimit(
  supabase: SupabaseClient,
  email: string,
  ipAddress: string,
) {
  const { data, error } = await supabase.rpc("consume_login_rate_limit", {
    p_ip_hash: digest("ip:" + ipAddress),
    p_email_hash: digest("email:" + email.trim().toLowerCase()),
    p_limit: 5,
    p_window_seconds: 600,
  });

  if (error) {
    console.error("login_rate_limit_unavailable", { message: error.message });
    return false;
  }

  return data === true;
}
