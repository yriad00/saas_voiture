"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/services/audit";
import { calculateReturnFacts, calculateReturnCharges } from "@/lib/services/return-workflow";
import { recordContractSignature } from "@/lib/services/signatures";
import { moroccoDateTimeLocalToIso } from "@/lib/morocco-time";
import { startPerf } from "@/lib/perf";

const requiredReturnPhotos = ["FRONT", "REAR", "LEFT", "RIGHT", "INTERIOR", "DASHBOARD"] as const;
const returnPhotoLabels: Record<(typeof requiredReturnPhotos)[number], string> = {
  FRONT: "avant", REAR: "arrière", LEFT: "côté gauche", RIGHT: "côté droit", INTERIOR: "intérieur", DASHBOARD: "tableau de bord",
};

const booleanField = z.preprocess((value) => value === true || value === "true", z.boolean());
const schema = z.object({
  contract_id: z.string().uuid(), branch_id: z.string().uuid(), actual_return_at: z.string().datetime({ offset: true }).or(z.string().min(1)),
  return_mileage: z.coerce.number().int().min(0), fuel_level: z.coerce.number().int().min(0).max(8),
  cleanliness: z.enum(["CLEAN", "ACCEPTABLE", "DIRTY"]), exterior_condition: z.string().max(2000).optional(), interior_condition: z.string().max(2000).optional(), missing_items: z.string().max(4000).optional(), notes: z.string().max(4000).optional(), signature_name: z.string().trim().min(2).max(160), signature_data: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "La signature est requise.").max(3000000).optional(), finalize: booleanField.optional(), review_confirmed: booleanField.optional(),
});

export type CheckinState = { error?: string; success?: boolean; review?: { lateDays: number; lateHours: number; drivenMileage: number; extraMileage: number; fuelDelta: number; mileageRuleNeedsReview: boolean; charges: number; draft?: Record<string, unknown> } };

export async function saveCheckin(_prev: CheckinState, formData: FormData, options?: { revalidate?: boolean }): Promise<CheckinState> {
  const endPerf = startPerf("saveCheckin");
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const d = parsed.data;
  const reject = (message: string, review?: CheckinState["review"]): CheckinState => {
    return review ? { error: message, review } : { error: message };
  };
  let actualReturnAt: string;
  try { actualReturnAt = moroccoDateTimeLocalToIso(d.actual_return_at); }
  catch { return reject("Date et heure de retour invalides pour le Maroc."); }
  const supabase = await createClient();
  const [{ data: contract }, { data: existing }] = await Promise.all([
    (supabase as any).from("contracts").select("id, agency_id, branch_id, return_branch_id, vehicle_id, reservation_id, status, start_mileage, end_date, end_at, daily_rate, fuel_level_start, mileage_policy, mileage_allowance, extra_mileage_rate, fuel_shortfall_rate, cleaning_fee").eq("id", d.contract_id).eq("agency_id", ctx.membership.agencyId).maybeSingle(),
    (supabase as any).from("contract_checkins").select("id,status,signature_data").eq("contract_id", d.contract_id).eq("agency_id", ctx.membership.agencyId).maybeSingle(),
  ]);
  if (!contract) return reject("Contrat introuvable.");
  if (contract.status !== "ACTIVE") return reject("Seule une location active peut être restituée.");
  if (ctx.membership.branchId && ctx.membership.branchId !== d.branch_id) return reject("Vous ne pouvez pas enregistrer un retour dans une autre agence.");
  if (contract.return_branch_id && contract.return_branch_id !== d.branch_id && !["AGENCY_OWNER", "MANAGER"].includes(ctx.membership.roleKey)) return reject("Le retour est prévu dans une autre agence. Un manager doit valider ce changement.");
  if (existing?.status === "FINALIZED") return reject("Le retour est déjà finalisé.");
  // A previous interrupted attempt may have finalized the inspection while
  // leaving the check-in in REVIEW. It is safe to resume that attempt; only a
  // finalized check-in itself is immutable.
  if (!d.signature_data && !existing?.signature_data) return reject("La signature client est requise pour le retour.");
  const { data: checkout } = await supabase.from("contract_checkouts").select("id,mileage").eq("contract_id", d.contract_id).eq("agency_id", ctx.membership.agencyId).maybeSingle();
  if (!checkout) return reject("Effectuez d’abord le check-out du véhicule.");
  if (contract.start_mileage !== null && d.return_mileage < contract.start_mileage) return reject("Le kilométrage de retour ne peut pas être inférieur au kilométrage de départ.");
  if (checkout.mileage !== null && d.return_mileage < checkout.mileage) return reject("Le kilométrage de retour ne peut pas être inférieur au kilométrage du check-out.");
  const { data: branch } = await supabase.from("branches").select("id").eq("id", d.branch_id).eq("agency_id", ctx.membership.agencyId).maybeSingle();
  if (!branch) return reject("Agence de retour non autorisée.");
  const mileagePolicy = ["UNLIMITED", "LIMITED"].includes(String(contract.mileage_policy)) ? contract.mileage_policy : "UNSPECIFIED";
  const facts = calculateReturnFacts({
    checkoutMileage: checkout.mileage ?? contract.start_mileage,
    returnMileage: d.return_mileage,
    checkoutFuel: contract.fuel_level_start,
    returnFuel: d.fuel_level,
    // New contracts carry an exact return instant. Historical date-only
    // contracts retain their existing date semantics until explicitly
    // migrated or renewed.
    plannedEnd: contract.end_at ?? contract.end_date,
    actualReturn: actualReturnAt,
    mileagePolicy,
    mileageAllowance: contract.mileage_allowance,
  });
  const prices = calculateReturnCharges(facts, {
    dailyRate: Number(contract.daily_rate),
    mileageRate: contract.extra_mileage_rate === null ? undefined : Number(contract.extra_mileage_rate),
    fuelRate: contract.fuel_shortfall_rate === null ? undefined : Number(contract.fuel_shortfall_rate),
    cleaningFee: contract.cleaning_fee === null ? undefined : Number(contract.cleaning_fee),
  }, d.cleanliness);
  const status = "REVIEW";
  if (d.finalize && !d.review_confirmed) return reject("Confirmez la revue du retour avant finalisation.", _prev.review);
  if (d.finalize) {
    const { data: photos, error: photoError } = await supabase.from("contract_inspection_photos")
      .select("photo_type")
      .eq("agency_id", ctx.membership.agencyId)
      .eq("contract_id", d.contract_id)
      .eq("inspection_type", "RETURN");
    if (photoError) return reject("Impossible de vérifier les photos de retour. Réessayez avant la finalisation.", _prev.review);
    const uploaded = new Set((photos ?? []).map((photo) => photo.photo_type));
    const missing = requiredReturnPhotos.filter((type) => !uploaded.has(type));
    if (missing.length) return reject(`Ajoutez les photos de retour manquantes : ${missing.map((type) => returnPhotoLabels[type]).join(", ")}.`, _prev.review);
  }
  const payload = { agency_id: ctx.membership.agencyId, branch_id: d.branch_id, contract_id: d.contract_id, vehicle_id: contract.vehicle_id, reservation_id: contract.reservation_id, actual_return_at: actualReturnAt, returned_by: ctx.user.id, return_mileage: d.return_mileage, fuel_level: d.fuel_level, cleanliness: d.cleanliness, exterior_condition: d.exterior_condition || null, interior_condition: d.interior_condition || null, missing_items: d.missing_items ? d.missing_items.split(",").map((v) => v.trim()).filter(Boolean) : [], notes: d.notes || null, signature_name: d.signature_name, signature_data: d.signature_data || null, status, finalized_at: null, finalized_by: null, updated_at: new Date().toISOString() };
  const { data: saved, error } = await (supabase as any).from("contract_checkins").upsert(payload, { onConflict: "contract_id" }).select("id").single();
  if (error || !saved) return reject(error?.message ?? "Impossible d'enregistrer le retour.");
  if (d.signature_data) {
    const { data: customerSignature } = await (supabase as any).from("contract_signatures").select("id").eq("contract_id", contract.id).eq("agency_id", ctx.membership.agencyId).eq("signer_type", "CUSTOMER").limit(1).maybeSingle();
    if (!customerSignature) {
      const signature = await recordContractSignature(supabase, { agencyId: ctx.membership.agencyId, branchId: d.branch_id, contractId: contract.id, signerType: "CUSTOMER", signerName: d.signature_name, signatureData: d.signature_data, actorId: ctx.user.id });
      if (signature.error) return reject(signature.error);
    }
  }
  if (d.finalize) {
    // The irreversible part is a single database transaction. The RPC locks
    // the contract/check-in, verifies the same business rules server-side,
    // recomputes automatic charges from the contract snapshot and only then
    // flips both inspection and check-in to FINALIZED.
    const { error: finalizeError } = await (supabase as any).rpc("finalize_contract_checkin", {
      p_agency_id: ctx.membership.agencyId,
      p_contract_id: d.contract_id,
      p_branch_id: d.branch_id,
      p_actual_return_at: actualReturnAt,
      p_return_mileage: d.return_mileage,
      p_fuel_level: d.fuel_level,
      p_cleanliness: d.cleanliness,
      p_exterior_condition: d.exterior_condition || null,
      p_interior_condition: d.interior_condition || null,
      p_missing_items: d.missing_items ? d.missing_items.split(",").map((v) => v.trim()).filter(Boolean) : [],
      p_notes: d.notes || null,
      p_signature_name: d.signature_name,
      p_signature_data: d.signature_data || existing?.signature_data || null,
    });
    if (finalizeError) return reject("Impossible de finaliser le retour. Vérifiez les photos et réessayez.", { ...facts, charges: prices.reduce((s, row) => s + row.amount, 0), draft: d });
  }
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, branchId: d.branch_id, actorId: ctx.user.id, action: d.finalize ? "CONTRACT_CHECKIN_FINALIZED" : "CONTRACT_CHECKIN_REVIEWED", entityType: "contract_checkin", entityId: saved.id, metadata: { contractId: d.contract_id, facts } });
  if (options?.revalidate !== false) revalidatePath(`/agency/contracts/${d.contract_id}`);
  endPerf();
  return d.finalize ? { success: true } : { review: { ...facts, charges: prices.reduce((s, row) => s + row.amount, 0), draft: d } };
}
