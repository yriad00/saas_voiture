"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/services/audit";
import { recordContractSignature } from "@/lib/services/signatures";
import { moroccoDateTimeLocalToIso } from "@/lib/morocco-time";
import { startPerf } from "@/lib/perf";

const schema = z.object({
  contract_id: z.string().uuid(),
  checkout_at: z.string().min(1),
  mileage: z.coerce.number().int().min(0),
  fuel_level: z.coerce.number().int().min(0).max(8),
  cleanliness: z.enum(["CLEAN", "ACCEPTABLE", "DIRTY"]),
  accessories: z.string().max(2000).optional(),
  keys_count: z.coerce.number().int().min(0).max(10),
  signature_name: z.string().trim().min(2).max(160),
  signature_data: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "La signature est requise.").max(3000000).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type CheckoutState = { error?: string; success?: boolean };

export async function saveCheckout(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const endPerf = startPerf("saveCheckout");
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Vérifiez les informations de sortie." };
  const d = parsed.data; const supabase = await createClient();
  let checkoutAt: string;
  try { checkoutAt = moroccoDateTimeLocalToIso(d.checkout_at); }
  catch { return { error: "Date et heure de sortie invalides pour le Maroc." }; }
  const { data: contract } = await supabase.from("contracts").select("id, branch_id, vehicle_id, reservation_id, status, start_mileage").eq("id", d.contract_id).eq("agency_id", ctx.membership.agencyId).maybeSingle();
  if (!contract) return { error: "Contrat introuvable." };
  if (contract.status !== "ACTIVE") return { error: "Le contrat doit être actif pour effectuer le check-out." };
  if (contract.start_mileage !== null && d.mileage < contract.start_mileage) return { error: "Le kilométrage de sortie ne peut pas être inférieur au kilométrage de départ." };
  const { data: preparation } = await supabase.from("vehicle_preparations").select("status").eq("contract_id", contract.id).eq("agency_id", ctx.membership.agencyId).maybeSingle();
  if (preparation && preparation.status !== "READY") return { error: "La préparation du véhicule doit être marquée prête avant le check-out." };
  let accessories: string[] = [];
  if (d.accessories?.trim()) accessories = d.accessories.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 30);
  const { data: checkout, error } = await supabase.from("contract_checkouts").upsert({
    agency_id: ctx.membership.agencyId, branch_id: contract.branch_id, contract_id: contract.id, reservation_id: contract.reservation_id,
    vehicle_id: contract.vehicle_id, checkout_at: checkoutAt, mileage: d.mileage, fuel_level: d.fuel_level,
    cleanliness: d.cleanliness, accessories, keys_count: d.keys_count, signature_name: d.signature_name,
    signature_data: d.signature_data || null, notes: d.notes || null, created_by: ctx.user.id, updated_at: new Date().toISOString(),
  }, { onConflict: "contract_id" }).select("id").single();
  if (error || !checkout) return { error: error?.message ?? "Impossible d'enregistrer le check-out." };
  if (d.signature_data) {
    const { data: customerSignature } = await (supabase as any).from("contract_signatures").select("id").eq("contract_id", contract.id).eq("agency_id", ctx.membership.agencyId).eq("signer_type", "CUSTOMER").limit(1).maybeSingle();
    if (!customerSignature) {
      const signature = await recordContractSignature(supabase, { agencyId: ctx.membership.agencyId, branchId: contract.branch_id, contractId: contract.id, signerType: "CUSTOMER", signerName: d.signature_name, signatureData: d.signature_data, actorId: ctx.user.id });
      if (signature.error) return { error: signature.error };
    }
  }
  await supabase.from("vehicles").update({ mileage: d.mileage }).eq("id", contract.vehicle_id).eq("agency_id", ctx.membership.agencyId);
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, branchId: contract.branch_id, action: "CONTRACT_CHECKOUT_COMPLETED", entityType: "contract", entityId: contract.id, metadata: { checkoutId: checkout.id, mileage: d.mileage, fuelLevel: d.fuel_level } });
  revalidatePath(`/agency/contracts/${contract.id}`); endPerf(); return { success: true };
}
