import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type MaintenanceListItem = Tables<"maintenance_records"> & {
  vehicleLabel: string;
};

export async function listMaintenance(agencyId: string): Promise<MaintenanceListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_records")
    // Some deployed projects do not expose the logical vehicle FK in the
    // PostgREST schema cache. Resolve the labels in a second scoped query so
    // the maintenance screen remains usable without weakening RLS.
    .select("*")
    .eq("agency_id", agencyId)
    .order("service_date", { ascending: false });
  if (error) throw error;

  const vehicleIds = [...new Set((data ?? []).map((m) => m.vehicle_id).filter(Boolean))];
  const { data: vehicles, error: vehicleError } = vehicleIds.length
    ? await supabase.from("vehicles").select("id,brand,model,license_plate").eq("agency_id", agencyId).in("id", vehicleIds)
    : { data: [], error: null };
  if (vehicleError) throw vehicleError;
  const vehicleById = new Map((vehicles ?? []).map((v) => [v.id, v]));

  return (data ?? []).map((m) => {
    const v = vehicleById.get(m.vehicle_id) as { brand: string; model: string; license_plate: string } | undefined;
    return {
      ...(m as Tables<"maintenance_records">),
      vehicleLabel: v ? `${v.brand} ${v.model} (${v.license_plate})` : "Véhicule indisponible",
    };
  });
}

export async function getMaintenanceTotals(agencyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("maintenance_records")
    .select("cost, status")
    .eq("agency_id", agencyId);

  const totalCost = (data ?? [])
    .filter((m) => m.status === "COMPLETED")
    .reduce((s, m) => s + Number(m.cost), 0);
  const scheduled = (data ?? []).filter((m) => m.status === "SCHEDULED").length;
  return { totalCost, scheduled, count: data?.length ?? 0 };
}
