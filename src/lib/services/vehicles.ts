import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables, Enums } from "@/lib/database.types";

export type VehicleRow = Tables<"vehicles">;

export async function listVehicles(agencyId: string): Promise<VehicleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("agency_id", agencyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getVehicle(id: string): Promise<VehicleRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

export type FleetStats = {
  total: number;
  byStatus: Record<Enums<"vehicle_status">, number>;
};

export async function getFleetStats(agencyId: string): Promise<FleetStats> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicles")
    .select("status")
    .eq("agency_id", agencyId)
    .is("deleted_at", null);

  const byStatus: Record<Enums<"vehicle_status">, number> = {
    AVAILABLE: 0,
    RENTED: 0,
    MAINTENANCE: 0,
    OUT_OF_SERVICE: 0,
    RESERVED: 0,
  };
  for (const v of data ?? []) byStatus[v.status]++;

  return { total: data?.length ?? 0, byStatus };
}
