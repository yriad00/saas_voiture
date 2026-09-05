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
    .select("*, vehicles!inner(brand, model, license_plate)")
    .eq("agency_id", agencyId)
    .order("service_date", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((m) => {
    const v = m.vehicles as unknown as { brand: string; model: string; license_plate: string };
    return {
      ...(m as Tables<"maintenance_records">),
      vehicleLabel: `${v.brand} ${v.model} (${v.license_plate})`,
    };
  });
}

export async function getMaintenanceTotals(agencyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("maintenance_records")
    .select("cost, status")
    .eq("agency_id", agencyId);

  const totalCost = (data ?? []).reduce((s, m) => s + Number(m.cost), 0);
  const scheduled = (data ?? []).filter((m) => m.status === "SCHEDULED").length;
  return { totalCost, scheduled, count: data?.length ?? 0 };
}
