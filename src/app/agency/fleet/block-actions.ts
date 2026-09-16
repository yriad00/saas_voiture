"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/services/audit";
import { consumeRateLimit } from "@/lib/services/rate-limit";

const schema = z.object({
  block_type: z.enum(["MAINTENANCE", "ADMIN", "TRANSFER", "DAMAGE"]),
  reason: z.string().min(2).max(500),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type VehicleBlockState = { error?: string; success?: boolean };

export async function createVehicleBlock(
  vehicleId: string,
  _prev: VehicleBlockState,
  formData: FormData,
): Promise<VehicleBlockState> {
  const ctx = await requireAgencyPermission("fleet:write", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Vérifiez le motif et les dates." };
  if (parsed.data.end_date < parsed.data.start_date) return { error: "La fin doit être postérieure au début." };
  const supabase = await createClient();
  if (!(await consumeRateLimit(supabase, "vehicle_blocks.create", 30, 60))) return { error: "Trop de blocages. Réessayez dans une minute." };
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, branch_id")
    .eq("id", vehicleId)
    .eq("agency_id", ctx.membership.agencyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!vehicle) return { error: "Véhicule introuvable dans cette agence ou cette branche." };
  const { data: block, error } = await supabase.from("vehicle_blocks").insert({
    agency_id: ctx.membership.agencyId,
    vehicle_id: vehicleId,
    branch_id: vehicle.branch_id ?? ctx.membership.branchId ?? null,
    block_type: parsed.data.block_type,
    reason: parsed.data.reason,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    created_by: ctx.user.id,
  }).select("id").single();
  if (error || !block) {
    if (error?.message.includes("vehicle_has_active_reservation")) return { error: "Une réservation active existe déjà sur cette période." };
    return { error: error?.message ?? "Impossible de bloquer le véhicule." };
  }
  await logAudit(supabase, {
    agencyId: ctx.membership.agencyId,
    actorId: ctx.user.id,
    branchId: vehicle.branch_id ?? ctx.membership.branchId,
    action: "VEHICLE_BLOCK_CREATED",
    entityType: "vehicle",
    entityId: vehicleId,
    metadata: { blockId: block.id, blockType: parsed.data.block_type, startDate: parsed.data.start_date, endDate: parsed.data.end_date },
  });
  revalidatePath(`/agency/fleet/${vehicleId}`);
  revalidatePath("/agency/calendar");
  return { success: true };
}

export async function cancelVehicleBlock(vehicleId: string, blockId: string) {
  const ctx = await requireAgencyPermission("fleet:write", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const supabase = await createClient();
  const { data: block } = await supabase.from("vehicle_blocks").select("id, branch_id").eq("id", blockId).eq("vehicle_id", vehicleId).eq("agency_id", ctx.membership.agencyId).maybeSingle();
  if (!block) return { error: "Blocage introuvable." };
  const { error } = await supabase.from("vehicle_blocks").update({ status: "CANCELLED" }).eq("id", blockId);
  if (error) return { error: error.message };
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, branchId: block.branch_id, action: "VEHICLE_BLOCK_CANCELLED", entityType: "vehicle", entityId: vehicleId, metadata: { blockId } });
  revalidatePath(`/agency/fleet/${vehicleId}`);
  revalidatePath("/agency/calendar");
  return { ok: true };
}
