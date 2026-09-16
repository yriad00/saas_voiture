"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/services/audit";
import { isPreparationReady } from "@/lib/services/preparations";

const checkbox = z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean());
const schema = z.object({
  contract_id: z.string().uuid(),
  vehicle_clean: checkbox,
  fuel_level_checked: checkbox,
  tires_checked: checkbox,
  documents_checked: checkbox,
  accessories_checked: checkbox,
  photos_checked: checkbox,
  keys_count: z.coerce.number().int().min(0).max(10),
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "BLOCKED"]).default("IN_PROGRESS"),
});
export type PreparationState = { error?: string; success?: boolean };

export async function saveVehiclePreparation(_prev: PreparationState, formData: FormData): Promise<PreparationState> {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Vérifiez la checklist de préparation." };
  const d = parsed.data; const supabase = await createClient();
  const { data: contract } = await supabase.from("contracts").select("id, agency_id, branch_id, vehicle_id, reservation_id, status").eq("id", d.contract_id).eq("agency_id", ctx.membership.agencyId).maybeSingle();
  if (!contract) return { error: "Contrat introuvable." };
  if (["CLOSED", "CANCELLED"].includes(contract.status)) return { error: "La préparation ne peut plus être modifiée." };
  const ready = isPreparationReady(d);
  const status = ready ? "READY" : d.status;
  const { data: preparation, error } = await supabase.from("vehicle_preparations").upsert({
    agency_id: ctx.membership.agencyId, branch_id: contract.branch_id, vehicle_id: contract.vehicle_id,
    reservation_id: contract.reservation_id, contract_id: contract.id, status,
    vehicle_clean: d.vehicle_clean, fuel_level_checked: d.fuel_level_checked, tires_checked: d.tires_checked,
    documents_checked: d.documents_checked, accessories_checked: d.accessories_checked, keys_count: d.keys_count,
    photos_checked: d.photos_checked, notes: d.notes || null, prepared_by: ctx.user.id,
    prepared_at: ready ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
  }, { onConflict: "contract_id" }).select("id").single();
  if (error || !preparation) return { error: error?.message ?? "Impossible d'enregistrer la préparation." };
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, branchId: contract.branch_id, action: "VEHICLE_PREPARATION_UPDATED", entityType: "contract", entityId: contract.id, metadata: { preparationId: preparation.id, status, ready } });
  revalidatePath(`/agency/contracts/${contract.id}`);
  return { success: true };
}
