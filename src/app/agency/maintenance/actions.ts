"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgency } from "@/lib/auth/session";

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
  set_vehicle_maintenance: z.coerce.boolean().default(false),
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
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
    return { error: "Veuillez corriger les champs.", fieldErrors: fe };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_records").insert({
    agency_id: ctx.membership.agencyId,
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
