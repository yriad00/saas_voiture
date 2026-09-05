import "server-only";

import { createClient as createAdminBase } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * SERVICE-ROLE client — bypasses RLS. NEVER import this into a Client Component.
 * The `server-only` import guarantees a build error if that is ever attempted.
 * Use strictly for privileged operations (e.g. creating agency owner auth users).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key === "PASTE_SERVICE_ROLE_KEY_HERE") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local from " +
        "Supabase Dashboard → Settings → API → service_role.",
    );
  }
  return createAdminBase<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
