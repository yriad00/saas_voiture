"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";
import { hasContractOverlap, hasReservationOverlap } from "@/lib/services/availability";
import { logAudit } from "@/lib/services/audit";
import { roundMoney } from "@/lib/utils";
import { moroccoDateTimeLocalToIso } from "@/lib/morocco-time";

const schema = z.object({
  contract_id: z.string().uuid(),
  new_end_date: z.string().min(1),
  new_end_time: z.string().regex(/^\d{2}:\d{2}$/).default("10:00"),
  reason: z.string().trim().min(2).max(1000),
});

export type ExtensionState = { error?: string; success?: boolean };

export async function extendRental(_prev: ExtensionState, formData: FormData): Promise<ExtensionState> {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Nouvelle date, heure et motif requis." };
  const d = parsed.data;
  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, branch_id, vehicle_id, reservation_id, status, start_date, end_date, start_at, end_at, daily_rate")
    .eq("id", d.contract_id)
    .eq("agency_id", ctx.membership.agencyId)
    .maybeSingle();
  if (!contract) return { error: "Contrat introuvable." };
  if (contract.status !== "ACTIVE") return { error: "Seul un contrat actif peut être prolongé." };

  let newEndAt: string;
  try { newEndAt = moroccoDateTimeLocalToIso(`${d.new_end_date}T${d.new_end_time}`); }
  catch { return { error: "La date/heure de prolongation est invalide." }; }
  const currentEndAt = contract.end_at ?? `${contract.end_date}T00:00:00.000Z`;
  if (new Date(newEndAt).getTime() <= new Date(currentEndAt).getTime()) return { error: "La nouvelle date doit être après la date actuelle." };
  const addedDays = Math.max(1, Math.ceil((new Date(newEndAt).getTime() - new Date(currentEndAt).getTime()) / 86400000));

  try {
    if (await hasContractOverlap(supabase, ctx.membership.agencyId, contract.vehicle_id, contract.start_date, d.new_end_date, contract.id, contract.start_at, newEndAt)) return { error: "Le véhicule est réservé par un autre contrat sur la période." };
    if (await hasReservationOverlap(supabase, ctx.membership.agencyId, contract.vehicle_id, contract.start_date, d.new_end_date, contract.reservation_id || undefined, contract.start_at, newEndAt)) return { error: "Le véhicule est réservé sur la période prolongée." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Impossible de vérifier la disponibilité." }; }

  const { error: updateError } = await supabase
    .from("contracts")
    .update({ end_date: d.new_end_date, end_at: newEndAt })
    .eq("id", contract.id)
    .eq("agency_id", ctx.membership.agencyId);
  if (updateError) return { error: updateError.message };

  const { data: extension, error } = await supabase.from("rental_extensions").insert({
    agency_id: ctx.membership.agencyId,
    branch_id: contract.branch_id,
    contract_id: contract.id,
    previous_end_date: contract.end_date,
    new_end_date: d.new_end_date,
    previous_end_at: contract.end_at ?? null,
    new_end_at: newEndAt,
    added_days: addedDays,
    daily_rate: Number(contract.daily_rate),
    extra_amount: roundMoney(addedDays * Number(contract.daily_rate)),
    reason: d.reason,
    status: "APPROVED",
    created_by: ctx.user.id,
    approved_by: ctx.user.id,
    approved_at: new Date().toISOString(),
  }).select("id").single();
  if (error || !extension) {
    await supabase.from("contracts").update({ end_date: contract.end_date, end_at: contract.end_at ?? null }).eq("id", contract.id).eq("agency_id", ctx.membership.agencyId);
    return { error: error?.message ?? "Impossible d'enregistrer la prolongation." };
  }
  await logAudit(supabase, {
    agencyId: ctx.membership.agencyId,
    branchId: contract.branch_id,
    actorId: ctx.user.id,
    action: "RENTAL_EXTENDED",
    entityType: "contract",
    entityId: contract.id,
    metadata: { extensionId: extension.id, from: contract.end_date, to: d.new_end_date, fromAt: contract.end_at ?? null, toAt: newEndAt, addedDays, amount: roundMoney(addedDays * Number(contract.daily_rate)) },
  });
  revalidatePath(`/agency/contracts/${contract.id}`);
  revalidatePath("/agency/contracts");
  return { success: true };
}
