import "server-only";

import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type AgencyEntitlements = {
  maxVehicles: number | null;
  maxUsers: number | null;
  maxBranches: number | null;
  currentVehicles: number;
  currentUsers: number;
  currentBranches: number;
};

export async function getAgencyEntitlements(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<AgencyEntitlements> {
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_id, status, ends_at, trial_ends_at")
    .eq("agency_id", agencyId)
    .in("status", ["ACTIVE", "TRIAL"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let maxVehicles: number | null = null;
  let maxUsers: number | null = null;
  let maxBranches: number | null = null;
  const subscriptionEnded = subscription?.ends_at && new Date(subscription.ends_at) < new Date();
  const trialEnded = subscription?.status === "TRIAL" && subscription.trial_ends_at && new Date(subscription.trial_ends_at) < new Date();

  if (subscription && !subscriptionEnded && !trialEnded) {
    const { data: plan } = await supabase
      .from("plans")
      .select("max_vehicles, max_users, max_branches")
      .eq("id", subscription.plan_id)
      .maybeSingle();
    maxVehicles = plan?.max_vehicles ?? null;
    maxUsers = plan?.max_users ?? null;
    maxBranches = plan?.max_branches ?? null;
  }

  const [{ count: currentVehicles }, { count: currentUsers }, { count: currentBranches }] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("agency_id", agencyId).is("deleted_at", null),
    supabase.from("agency_members").select("id", { count: "exact", head: true }).eq("agency_id", agencyId).in("status", ["active", "invited"]),
    supabase.from("branches").select("id", { count: "exact", head: true }).eq("agency_id", agencyId).eq("active", true),
  ]);

  return {
    maxVehicles,
    maxUsers,
    maxBranches,
    currentVehicles: currentVehicles ?? 0,
    currentUsers: currentUsers ?? 0,
    currentBranches: currentBranches ?? 0,
  };
}
