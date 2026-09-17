import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import stagingTarget from "../../scripts/staging-target.cjs";

const { assertStagingTarget } = stagingTarget;

function requireStagingUrl() {
  const raw = process.env.FLEETHUB_TEST_SUPABASE_URL;
  if (!raw) throw new Error("FLEETHUB_TEST_SUPABASE_URL is required for browser assertions.");
  return assertStagingTarget(raw, "FLEETHUB_TEST_SUPABASE_URL").toString().replace(/\/$/, "");
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
