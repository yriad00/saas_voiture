import "server-only";

import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function logAudit(
  supabase: SupabaseClient,
  input: {
    agencyId?: string | null;
    actorId?: string | null;
    branchId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Json;
  },
) {
  let branchId = input.branchId ?? null;
  if (input.branchId === undefined && input.agencyId) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { data: membership } = await supabase
        .from("agency_members")
        .select("branch_id")
        .eq("agency_id", input.agencyId)
        .eq("profile_id", auth.user.id)
        .eq("status", "active")
        .maybeSingle();
      branchId = membership?.branch_id ?? null;
    }
  }
  const { error } = await supabase.from("audit_logs").insert({
    agency_id: input.agencyId ?? null,
    branch_id: branchId,
    actor_id: input.actorId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) console.error("audit_log_insert_failed", error.message);
}
