import "server-only";

import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Consume one authenticated-user token from a Postgres-backed fixed window.
 * The SQL function owns the bucket by auth.uid(), so a caller cannot rate-limit
 * or impersonate another user. If the limiter is unavailable, fail open and
 * leave the failure visible in server logs rather than taking the rental desk
 * offline; the database constraints and permission guards remain enforced.
 */
export async function consumeRateLimit(
  supabase: SupabaseClient,
  scope: string,
  limit: number,
  windowSeconds: number,
) {
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_scope: scope,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate_limit_unavailable", { scope, message: error.message });
    return true;
  }
  return data === true;
}
