"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/services/audit";

const optionalInt = z.preprocess((value) => value === "" || value == null ? undefined : value, z.coerce.number().int().min(0).optional());
const schema = z.object({
  contract_id: z.string().uuid(), event_type: z.enum(["MILEAGE", "CUSTOMER_CONTACT", "GPS_ALERT", "DAMAGE_REPORT", "OTHER"]),
  occurred_at: z.string().min(1), mileage: optionalInt, fuel_level: z.preprocess((value) => value === "" || value == null ? undefined : value, z.coerce.number().int().min(0).max(8).optional()),
  location: z.string().trim().max(300).optional(), notes: z.string().trim().min(2).max(2000),
});
export type ActiveRentalState = { error?: string; success?: boolean };
export async function recordActiveRentalUpdate(_prev: ActiveRentalState, formData: FormData): Promise<ActiveRentalState> {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]); const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Vérifiez l'événement de location." };
  const d = parsed.data; const supabase = await createClient();
  const { data: contract } = await supabase.from("contracts").select("id, branch_id, vehicle_id, status").eq("id", d.contract_id).eq("agency_id", ctx.membership.agencyId).maybeSingle();
  if (!contract) return { error: "Contrat introuvable." }; if (contract.status !== "ACTIVE") return { error: "Le contrat n'est pas actif." };
  const { data: update, error } = await supabase.from("active_rental_updates").insert({ agency_id: ctx.membership.agencyId, branch_id: contract.branch_id, contract_id: contract.id, vehicle_id: contract.vehicle_id, event_type: d.event_type, occurred_at: new Date(d.occurred_at).toISOString(), mileage: d.mileage ?? null, fuel_level: d.fuel_level ?? null, location: d.location || null, notes: d.notes, created_by: ctx.user.id }).select("id").single();
  if (error || !update) return { error: error?.message ?? "Impossible d'enregistrer l'événement." };
  if (d.mileage !== undefined) await supabase.from("vehicles").update({ mileage: d.mileage }).eq("id", contract.vehicle_id).eq("agency_id", ctx.membership.agencyId);
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, branchId: contract.branch_id, action: "ACTIVE_RENTAL_UPDATE_RECORDED", entityType: "contract", entityId: contract.id, metadata: { updateId: update.id, eventType: d.event_type, mileage: d.mileage ?? null } });
  revalidatePath(`/agency/contracts/${contract.id}`); return { success: true };
}
