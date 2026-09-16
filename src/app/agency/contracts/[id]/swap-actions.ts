"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";
import { hasContractOverlap, hasReservationOverlap, syncVehicleStatus } from "@/lib/services/availability";
import { logAudit } from "@/lib/services/audit";
const optionalInt = z.preprocess((value) => value === "" || value == null ? undefined : value, z.coerce.number().int().min(0).optional());
const schema = z.object({ contract_id: z.string().uuid(), new_vehicle_id: z.string().uuid(), reason: z.string().trim().min(2).max(1000), new_mileage: optionalInt, fuel_level: z.preprocess((value) => value === "" || value == null ? undefined : value, z.coerce.number().int().min(0).max(8).optional()) });
export type SwapState = { error?: string; success?: boolean };
export async function swapVehicle(_prev: SwapState, formData: FormData): Promise<SwapState> {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]); const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Véhicule et motif requis." };
  const d = parsed.data; const supabase = await createClient();
  const [{ data: contract }, { data: nextVehicle }] = await Promise.all([
    supabase.from("contracts").select("id, branch_id, vehicle_id, reservation_id, start_date, end_date, status").eq("id", d.contract_id).eq("agency_id", ctx.membership.agencyId).maybeSingle(),
    supabase.from("vehicles").select("id, branch_id, status, mileage").eq("id", d.new_vehicle_id).eq("agency_id", ctx.membership.agencyId).is("deleted_at", null).maybeSingle(),
  ]);
  if (!contract || !nextVehicle) return { error: "Contrat ou véhicule introuvable." }; if (contract.status !== "ACTIVE") return { error: "Seul un contrat actif peut changer de véhicule." }; if (contract.vehicle_id === nextVehicle.id) return { error: "Le véhicule est déjà celui du contrat." }; if (nextVehicle.branch_id !== contract.branch_id) return { error: "Le véhicule doit appartenir à la même branche." }; if (["OUT_OF_SERVICE", "MAINTENANCE", "RENTED"].includes(nextVehicle.status)) return { error: "Le véhicule cible n'est pas disponible." };
  try { if (await hasContractOverlap(supabase, ctx.membership.agencyId, nextVehicle.id, contract.start_date, contract.end_date)) return { error: "Le véhicule cible a déjà un contrat." }; if (await hasReservationOverlap(supabase, ctx.membership.agencyId, nextVehicle.id, contract.start_date, contract.end_date, contract.reservation_id || undefined)) return { error: "Le véhicule cible est réservé." }; } catch (error) { return { error: error instanceof Error ? error.message : "Impossible de vérifier la disponibilité." }; }
  const { error: updateError } = await supabase.from("contracts").update({ vehicle_id: nextVehicle.id }).eq("id", contract.id).eq("agency_id", ctx.membership.agencyId);
  if (updateError) return { error: updateError.message };
  const { data: swap, error } = await supabase.from("vehicle_swaps").insert({ agency_id: ctx.membership.agencyId, branch_id: contract.branch_id, contract_id: contract.id, old_vehicle_id: contract.vehicle_id, new_vehicle_id: nextVehicle.id, reason: d.reason, new_mileage: d.new_mileage ?? nextVehicle.mileage, fuel_level: d.fuel_level ?? null, created_by: ctx.user.id }).select("id").single();
  if (error || !swap) { await supabase.from("contracts").update({ vehicle_id: contract.vehicle_id }).eq("id", contract.id).eq("agency_id", ctx.membership.agencyId); return { error: error?.message ?? "Impossible d'enregistrer le swap." }; }
  if (d.new_mileage !== undefined) await supabase.from("vehicles").update({ mileage: d.new_mileage }).eq("id", nextVehicle.id).eq("agency_id", ctx.membership.agencyId);
  await syncVehicleStatus(supabase, ctx.membership.agencyId, contract.vehicle_id); await syncVehicleStatus(supabase, ctx.membership.agencyId, nextVehicle.id);
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, branchId: contract.branch_id, action: "VEHICLE_SWAPPED", entityType: "contract", entityId: contract.id, metadata: { swapId: swap.id, oldVehicleId: contract.vehicle_id, newVehicleId: nextVehicle.id } });
  revalidatePath(`/agency/contracts/${contract.id}`); revalidatePath("/agency/fleet"); return { success: true };
}
