export const STAGING_SUPABASE_HOSTNAME = "nyurwczpxpcpwqamfoek.supabase.co";

/**
 * Return a parsed staging URL only when the target is the exact HTTPS
 * Supabase staging host. Fixture and cleanup scripts use this fail-closed
 * guard before any database or Storage mutation.
 */
export function assertStagingTarget(value, label = "staging target") {
  if (!value || typeof value !== "string") {
    throw new Error(`${label} is required.`);
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== STAGING_SUPABASE_HOSTNAME) {
    throw new Error(`${label} must use exact staging host ${STAGING_SUPABASE_HOSTNAME}.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not contain embedded credentials.`);
  }
  return parsed;
}
