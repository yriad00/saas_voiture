import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import { roundMoney } from "@/lib/utils";

export type ExtraPricingType = "PER_DAY" | "FLAT" | "PER_UNIT";
export type ExtraCatalog = Tables<"extras_catalog">;

export function calculateExtraTotal(type: ExtraPricingType, unitPrice: number, quantity: number, days: number): number {
  const multiplier = type === "PER_DAY" ? Math.max(1, days) : 1;
  return roundMoney(Math.max(0, unitPrice) * Math.max(1, quantity) * multiplier);
}

export async function listActiveExtras(
  supabase: SupabaseClient<Database>,
  agencyId: string,
  branchId: string | null,
) {
  let query = supabase
    .from("extras_catalog")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("active", true)
    .order("name");
  if (branchId) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
  return query;
}

export async function getReservationExtras(supabase: SupabaseClient<Database>, reservationId: string, agencyId: string) {
  return supabase.from("reservation_extras").select("*").eq("reservation_id", reservationId).eq("agency_id", agencyId).order("created_at");
}

export async function getContractExtras(supabase: SupabaseClient<Database>, contractId: string, agencyId: string) {
  return supabase.from("contract_extras").select("*").eq("contract_id", contractId).eq("agency_id", agencyId).order("created_at");
}
