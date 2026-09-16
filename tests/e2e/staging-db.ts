import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STAGING_HOST = "nyurwczpxpcpwqamfoek.supabase.co";

function requireStagingUrl() {
  const raw = process.env.FLEETHUB_TEST_SUPABASE_URL;
  if (!raw) throw new Error("FLEETHUB_TEST_SUPABASE_URL is required for browser assertions.");
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:" || parsed.hostname !== STAGING_HOST || raw.includes("wewajfotwphufsthfgul")) {
    throw new Error(`Refusing browser DB assertion for non-staging host: ${parsed.hostname}`);
  }
  return raw.replace(/\/$/, "");
}

let client: SupabaseClient | undefined;

export function stagingDb() {
  if (client) return client;
  const key = process.env.FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("FLEETHUB_TEST_SUPABASE_SERVICE_ROLE_KEY is required in the test process only.");
  client = createClient(requireStagingUrl(), key, { auth: { autoRefreshToken: false, persistSession: false } });
  return client;
}

export async function one<T = Record<string, unknown>>(table: string, filters: Record<string, string>) {
  let query = stagingDb().from(table).select("*").limit(1);
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { data, error } = await query.maybeSingle<T>();
  if (error) throw new Error(`${table} lookup failed: ${error.message}`);
  return data;
}

export async function rows<T = Record<string, unknown>>(table: string, filters: Record<string, string> = {}) {
  let query = stagingDb().from(table).select("*");
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { data, error } = await query;
  if (error) throw new Error(`${table} lookup failed: ${error.message}`);
  return (data ?? []) as T[];
}

export async function count(table: string, filters: Record<string, string> = {}) {
  let query = stagingDb().from(table).select("id", { count: "exact", head: true });
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { count: value, error } = await query;
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return value ?? 0;
}
