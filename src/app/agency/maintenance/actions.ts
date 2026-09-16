"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";
import { syncVehicleStatus } from "@/lib/services/availability";

const schema = z.object({
  vehicle_id: z.string().uuid("Sélectionnez un véhicule"),
  type: z.enum(["OIL_CHANGE", "TIRES", "INSPECTION", "REPAIR", "CLEANING", "OTHER"]).default("OTHER"),
  description: z.string().optional(),
  cost: z.coerce.number().min(0).default(0),
  mileage_at_service: z.coerce.number().int().min(0).optional(),
  service_date: z.string().min(1, "Date requise"),
  next_service_date: z.string().optional(),
  garage_name: z.string().optional(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("COMPLETED"),
  set_vehicle_maintenance: z.preprocess((value) => value === "on" || value === "true", z.boolean()).default(false),
});

export type MaintenanceFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
};

export async function createMaintenance(
  _prev: MaintenanceFormState,
  formData: FormData,
): Promise<MaintenanceFormState> {
  const ctx = await requireAgencyPermission("maintenance.create", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
    return { error: "Veuillez corriger les champs.", fieldErrors: fe };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, branch_id")
    .eq("id", d.vehicle_id)
    .eq("agency_id", ctx.membership.agencyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!vehicle) return { error: "Véhicule introuvable dans cette agence." };
  const { error } = await supabase.from("maintenance_records").insert({
    agency_id: ctx.membership.agencyId,
    branch_id: vehicle.branch_id ?? ctx.membership.branchId ?? null,
    vehicle_id: d.vehicle_id,
    type: d.type,
    description: d.description || null,
    cost: d.cost,
    mileage_at_service: d.mileage_at_service ?? null,
    service_date: d.service_date,
    next_service_date: d.next_service_date || null,
    garage_name: d.garage_name || null,
    status: d.status,
    created_by: ctx.user.id,
  });
  if (error) return { error: error.message };

  // Optionally flag the vehicle as in maintenance.
  if (d.set_vehicle_maintenance && (d.status === "SCHEDULED" || d.status === "IN_PROGRESS")) {
    await supabase.from("vehicles").update({ status: "MAINTENANCE" }).eq("id", d.vehicle_id).eq("agency_id", ctx.membership.agencyId);
  }

  revalidatePath("/agency/maintenance");
  return { success: true };
}

export async function setMaintenanceStatus(recordId: string, status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED") {
  const ctx = await requireAgencyPermission("maintenance.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const supabase = await createClient();
  const { data: record } = await supabase
    .from("maintenance_records")
    .select("id, vehicle_id, status")
    .eq("id", recordId)
    .eq("agency_id", ctx.membership.agencyId)
    .maybeSingle();
  if (!record) return { error: "Intervention introuvable." };
  if (record.status === status) return { ok: true };

  const { error } = await supabase
    .from("maintenance_records")
    .update({ status })
    .eq("id", recordId)
    .eq("agency_id", ctx.membership.agencyId);
  if (error) return { error: error.message };
  try {
    await syncVehicleStatus(supabase, ctx.membership.agencyId, record.vehicle_id);
  } catch (syncError) {
    return { error: syncError instanceof Error ? syncError.message : "Impossible de synchroniser le véhicule." };
  }
  revalidatePath("/agency/maintenance");
  revalidatePath(`/agency/fleet/${record.vehicle_id}`);
  return { ok: true };
}
