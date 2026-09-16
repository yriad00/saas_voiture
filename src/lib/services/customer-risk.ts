import "server-only";

import type { Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
export type CustomerRiskFlag = Tables<"customer_risk_flags">;

export async function getOpenCustomerRiskFlag(
  supabase: SupabaseClient,
  agencyId: string,
  customerId: string,
) {
  const { data, error } = await supabase
    .from("customer_risk_flags")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("customer_id", customerId)
    .eq("status", "OPEN")
    .maybeSingle();
  if (error) throw error;
  return data as CustomerRiskFlag | null;
}
