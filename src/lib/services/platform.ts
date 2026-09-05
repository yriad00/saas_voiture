import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/database.types";

export type PlatformStats = {
  totalAgencies: number;
  byStatus: Record<Enums<"agency_status">, number>;
  totalStaff: number;
  activeSubscriptions: number;
  mrr: number;
};

/** Platform-wide statistics for the super-admin dashboard. RLS lets super-admin read all. */
export async function getPlatformStats(): Promise<PlatformStats> {
  const supabase = await createClient();

  const [{ data: agencies }, { count: staffCount }, { data: subs }] = await Promise.all([
    supabase.from("agencies").select("status").is("deleted_at", null),
    supabase.from("agency_members").select("*", { count: "exact", head: true }),
    supabase.from("subscriptions").select("status, amount"),
  ]);

  const byStatus: Record<Enums<"agency_status">, number> = {
    ACTIVE: 0,
    TRIAL: 0,
    INACTIVE: 0,
    SUSPENDED: 0,
    EXPIRED: 0,
  };
  for (const a of agencies ?? []) byStatus[a.status]++;

  const activeSubs = (subs ?? []).filter((s) => s.status === "ACTIVE" || s.status === "TRIAL");
  const mrr = (subs ?? [])
    .filter((s) => s.status === "ACTIVE")
    .reduce((sum, s) => sum + Number(s.amount), 0);

  return {
    totalAgencies: agencies?.length ?? 0,
    byStatus,
    totalStaff: staffCount ?? 0,
    activeSubscriptions: activeSubs.length,
    mrr,
  };
}
