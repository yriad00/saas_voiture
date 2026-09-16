"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, requireAgencyPermission } from "@/lib/auth/session";
import { nextContractNumber } from "@/lib/services/contracts";
import { hasContractOverlap, hasReservationOverlap, syncVehicleStatus } from "@/lib/services/availability";
import type { Enums } from "@/lib/database.types";
import { roundMoney } from "@/lib/utils";
import { startPerf } from "@/lib/perf";
import { logAudit } from "@/lib/services/audit";
import { getContractFinancials } from "@/lib/services/financials";
import { moroccoDateTimeLocalToIso } from "@/lib/morocco-time";

const optionalInteger = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.coerce.number().int().min(0).optional(),
);

const schema = z.object({
  branch_id: z.string().uuid().optional().or(z.literal("")),
  return_branch_id: z.string().uuid().optional().or(z.literal("")),
  reservation_id: z.string().uuid().optional().or(z.literal("")),
  customer_id: z.string().uuid("Sélectionnez un client"),
  vehicle_id: z.string().uuid("Sélectionnez un véhicule"),
  start_date: z.string().min(1, "Date de début requise"),
  end_date: z.string().min(1, "Date de fin requise"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Heure de début invalide").default("10:00"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Heure de fin invalide").default("10:00"),
  daily_rate: z.coerce.number().min(0).default(0),
  deposit_amount: z.coerce.number().min(0).default(0),
  one_way_fee: z.coerce.number().min(0).default(0),
  total_amount: z.coerce.number().min(0).default(0),
  start_mileage: optionalInteger,
  fuel_level_start: z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.coerce.number().int().min(0).max(8).optional(),
  ),
  terms: z.string().optional(),
  terms_ar: z.string().optional(),
  contract_language: z.enum(["FR", "AR", "BILINGUAL"]).default("FR"),
  payer_customer_id: z.string().uuid().optional().or(z.literal("")),
  principal_driver_customer_id: z.string().uuid().optional().or(z.literal("")),
  early_return_policy: z.enum(["NO_REFUND", "RECALCULATE", "PARTIAL_REFUND", "MANAGER_DECISION"]).default("MANAGER_DECISION"),
});

export type ContractFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: { id: string };
};

export async function createContract(
  _prev: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const endPerf = startPerf("createContract");
  const ctx = await requireAgencyPermission("contracts.create", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
    return { error: "Veuillez corriger les champs.", fieldErrors: fe };
  }
  const d = parsed.data;

  const start = new Date(d.start_date);
  const end = new Date(d.end_date);
  let startAt: string;
  let endAt: string;
  try {
    startAt = moroccoDateTimeLocalToIso(`${d.start_date}T${d.start_time}`);
    endAt = moroccoDateTimeLocalToIso(`${d.end_date}T${d.end_time}`);
  } catch {
    return { error: "La date ou l’heure du contrat est invalide.", fieldErrors: { end_date: "Date/heure invalide" } };
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    return { error: "La date de fin doit être postérieure à la date de début.", fieldErrors: { end_date: "Date invalide" } };
  }

  const supabase = await createClient();
  let reservationExtras: Array<{ extra_id: string; code: string; name: string; pricing_type: string; quantity: number; unit_price: number; total_amount: number; notes: string | null }> = [];

  const { data: settings } = await supabase
    .from("agency_settings")
    .select("default_deposit, deposit_required, cancellation_policy, late_return_policy, fuel_policy, mileage_policy, mileage_allowance, extra_mileage_rate, fuel_shortfall_rate, cleaning_fee")
    .eq("agency_id", ctx.membership.agencyId)
    .maybeSingle();
  const chargeSettings = settings as (typeof settings & {
    mileage_policy?: string | null;
    mileage_allowance?: number | null;
    extra_mileage_rate?: number | null;
    fuel_shortfall_rate?: number | null;
    cleaning_fee?: number | null;
  }) | null;

  const [{ data: customer }, { data: vehicle }] = await Promise.all([
    supabase.from("customers").select("id").eq("id", d.customer_id).eq("agency_id", ctx.membership.agencyId).is("deleted_at", null).maybeSingle(),
    supabase.from("vehicles").select("id, status, branch_id").eq("id", d.vehicle_id).eq("agency_id", ctx.membership.agencyId).is("deleted_at", null).maybeSingle(),
  ]);
  if (!customer) return { error: "Client introuvable dans cette agence." };
  if (!vehicle) return { error: "Véhicule introuvable dans cette agence." };
  const { data: riskFlag } = await supabase
    .from("customer_risk_flags")
    .select("id, reason")
    .eq("agency_id", ctx.membership.agencyId)
    .eq("customer_id", d.customer_id)
    .eq("status", "OPEN")
    .maybeSingle();
  if (riskFlag && !can(ctx, "customers.blacklist.manage")) {
    return { error: "Ce client est signalé. Un manager doit résoudre le signalement avant de créer le contrat." };
  }
  if (["OUT_OF_SERVICE", "MAINTENANCE"].includes(vehicle.status)) {
    return { error: "Ce véhicule n'est pas prêt pour un contrat." };
  }

  if (d.reservation_id) {
    const { data: reservation } = await (supabase as any)
      .from("reservations")
      .select("customer_id, vehicle_id, branch_id, pickup_branch_id, return_branch_id, one_way_fee, start_date, end_date, pickup_at, return_at, status, vehicle_category")
      .eq("id", d.reservation_id)
      .eq("agency_id", ctx.membership.agencyId)
      .maybeSingle();
    if (!reservation) return { error: "Réservation introuvable dans cette agence." };
    if (["CANCELLED", "COMPLETED", "NO_SHOW"].includes(reservation.status)) return { error: "Cette réservation n'est plus active." };
    if (reservation.customer_id !== d.customer_id || reservation.vehicle_id !== d.vehicle_id) {
      return { error: "Le client et le véhicule ne correspondent pas à la réservation." };
    }
    const { data: sourceExtras } = await supabase
      .from("reservation_extras")
      .select("extra_id, code, name, pricing_type, quantity, unit_price, total_amount, notes")
      .eq("reservation_id", d.reservation_id)
      .eq("agency_id", ctx.membership.agencyId);
    reservationExtras = sourceExtras ?? [];
  }

  try {
    if (await hasContractOverlap(supabase, ctx.membership.agencyId, d.vehicle_id, d.start_date, d.end_date, undefined, startAt, endAt)) {
      return { error: "Ce véhicule a déjà un contrat actif sur cette période." };
    }
    if (await hasReservationOverlap(supabase, ctx.membership.agencyId, d.vehicle_id, d.start_date, d.end_date, d.reservation_id || undefined, startAt, endAt)) {
      return { error: "Ce véhicule est déjà réservé sur cette période." };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible de vérifier la disponibilité." };
  }

  const contractNumber = await nextContractNumber(ctx.membership.agencyId);
  const reservationSource = d.reservation_id ? (await (supabase as any).from("reservations").select("branch_id,pickup_branch_id,return_branch_id,one_way_fee,pickup_at,return_at").eq("id", d.reservation_id).eq("agency_id", ctx.membership.agencyId).maybeSingle()).data : null;
  const branchId = d.branch_id || reservationSource?.pickup_branch_id || reservationSource?.branch_id || vehicle.branch_id || ctx.membership.branchId || null;
  const oneWayFee = d.one_way_fee || Number(reservationSource?.one_way_fee ?? 0);
  const depositAmount = d.deposit_amount > 0
    ? roundMoney(d.deposit_amount)
    : settings?.deposit_required
      ? roundMoney(Number(settings.default_deposit ?? 0))
      : 0;
  const policyTerms = [
    d.terms,
    settings?.cancellation_policy ? `Annulation : ${settings.cancellation_policy}` : null,
    settings?.late_return_policy ? `Retour tardif : ${settings.late_return_policy}` : null,
    settings?.fuel_policy ? `Carburant : ${settings.fuel_policy}` : null,
  ].filter(Boolean).join("\n\n") || null;

  const { data: created, error } = await (supabase as any)
    .from("contracts")
    .insert({
      agency_id: ctx.membership.agencyId,
      branch_id: branchId,
      pickup_branch_id: branchId,
      return_branch_id: d.return_branch_id || reservationSource?.return_branch_id || branchId,
      reservation_id: d.reservation_id || null,
      customer_id: d.customer_id,
      vehicle_id: d.vehicle_id,
      contract_number: contractNumber,
      start_date: d.start_date,
      end_date: d.end_date,
      start_at: reservationSource?.pickup_at ?? startAt,
      end_at: reservationSource?.return_at ?? endAt,
      daily_rate: d.daily_rate,
      deposit_amount: depositAmount,
      one_way_fee: oneWayFee,
      payer_customer_id: d.payer_customer_id || d.customer_id,
      principal_driver_customer_id: d.principal_driver_customer_id || d.customer_id,
      early_return_policy: d.early_return_policy,
      mileage_policy: ["UNLIMITED", "LIMITED"].includes(String(chargeSettings?.mileage_policy)) ? String(chargeSettings?.mileage_policy) : "UNSPECIFIED",
      mileage_allowance: chargeSettings?.mileage_allowance ?? null,
      extra_mileage_rate: chargeSettings?.extra_mileage_rate ?? null,
      fuel_shortfall_rate: chargeSettings?.fuel_shortfall_rate ?? null,
      cleaning_fee: chargeSettings?.cleaning_fee ?? null,
      base_total_amount: roundMoney(Math.max(0, d.total_amount - reservationExtras.reduce((sum, extra) => sum + Number(extra.total_amount), 0))),
      extras_total: 0,
      total_amount: roundMoney(d.total_amount + oneWayFee),
      start_mileage: d.start_mileage ?? null,
      fuel_level_start: d.fuel_level_start ?? null,
      terms: policyTerms,
      terms_ar: d.terms_ar || null,
      contract_language: d.contract_language,
      terms_version: 1,
      status: "DRAFT",
      signed_at: null,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();

  if (error || !created) return { error: error?.message ?? "Impossible de créer le contrat." };

  if (depositAmount > 0) {
    const { error: depositError } = await (supabase as any).from("deposits").insert({
      agency_id: ctx.membership.agencyId,
      branch_id: branchId,
      contract_id: created.id,
      required_amount: depositAmount,
    });
    if (depositError) {
      await supabase.from("contracts").delete().eq("id", created.id).eq("agency_id", ctx.membership.agencyId);
      return { error: depositError.message };
    }
  }

  if (reservationExtras.length > 0) {
    const { error: extrasError } = await supabase.from("contract_extras").insert(reservationExtras.map((extra) => ({
      agency_id: ctx.membership.agencyId,
      branch_id: branchId,
      contract_id: created.id,
      extra_id: extra.extra_id,
      code: extra.code,
      name: extra.name,
      pricing_type: extra.pricing_type,
      quantity: extra.quantity,
      unit_price: extra.unit_price,
      total_amount: extra.total_amount,
      notes: extra.notes,
      created_by: ctx.user.id,
    })));
    if (extrasError) {
      await supabase.from("contracts").delete().eq("id", created.id).eq("agency_id", ctx.membership.agencyId);
      return { error: extrasError.message };
    }
  }

  await logAudit(supabase, {
    agencyId: ctx.membership.agencyId,
    actorId: ctx.user.id,
    action: "CONTRACT_CREATED",
    entityType: "contract",
    entityId: created.id,
    metadata: { contractNumber, vehicleId: d.vehicle_id, status: "DRAFT" },
  });
  if (riskFlag) {
    await logAudit(supabase, {
      agencyId: ctx.membership.agencyId,
      actorId: ctx.user.id,
      action: "CUSTOMER_RISK_OVERRIDE",
      entityType: "customer",
      entityId: d.customer_id,
      metadata: { riskFlagId: riskFlag.id, contractId: created.id, reason: riskFlag.reason },
    });
  }

  revalidatePath("/agency/contracts");
  endPerf();
  return { success: { id: created.id } };
}

/** Close a contract: record end mileage/fuel, set vehicle available, reservation completed. */
  const closeSchema = z.object({
  end_mileage: optionalInteger,
  fuel_level_end: z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.coerce.number().int().min(0).max(8).optional(),
  ),
});

export async function closeContract(contractId: string, formData: FormData) {
  const endPerf = startPerf("closeContract");
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = closeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Valeurs invalides." };

  const supabase = await createClient();
  const { data: contract } = await (supabase as any)
    .from("contracts")
    .select("vehicle_id, reservation_id, status, start_mileage, base_total_amount, extras_total, return_charges_total, end_date, end_at, early_return_policy, early_return_decision, branch_id, return_branch_id")
    .eq("id", contractId)
    .eq("agency_id", ctx.membership.agencyId)
    .maybeSingle();
  if (!contract) return { error: "Contrat introuvable." };
  if (contract.status !== "ACTIVE") return { error: "Seul un contrat actif peut être clôturé." };
  if (contract.return_branch_id && contract.return_branch_id !== contract.branch_id && !["AGENCY_OWNER", "MANAGER"].includes(ctx.membership.roleKey)) {
    return { error: "Un responsable doit clôturer une location restituée dans une autre agence." };
  }
  const { data: checkin } = await (supabase as any)
    .from("contract_checkins")
    .select("status, branch_id, return_mileage, fuel_level, actual_return_at")
    .eq("contract_id", contractId)
    .eq("agency_id", ctx.membership.agencyId)
    .maybeSingle();
  if (!checkin || checkin.status !== "FINALIZED") return { error: "Finalisez d'abord le check-in et sa revue financière." };
  const isEarlyReturn = checkin.actual_return_at && new Date(checkin.actual_return_at).getTime() < new Date(contract.end_at ?? `${contract.end_date}T00:00:00.000Z`).getTime();
  if (isEarlyReturn && !contract.early_return_decision) {
    return { error: "Enregistrez la décision manager pour ce retour anticipé avant la clôture." };
  }
  const { data: returnInspection } = await (supabase as any)
    .from("contract_inspections")
    .select("id,status")
    .eq("contract_id", contractId)
    .eq("agency_id", ctx.membership.agencyId)
    .eq("inspection_type", "RETURN")
    .maybeSingle();
  if (!returnInspection || returnInspection.status !== "FINALIZED") return { error: "Le constat de restitution finalisé est requis avant la clôture." };
  if (parsed.data.end_mileage === undefined && checkin.return_mileage !== null) parsed.data.end_mileage = checkin.return_mileage;
  if (parsed.data.fuel_level_end === undefined && checkin.fuel_level !== null) parsed.data.fuel_level_end = checkin.fuel_level;
  const [{ data: deposit }] = await Promise.all([
    (supabase as any).from("deposits").select("required_amount,status").eq("contract_id", contractId).eq("agency_id", ctx.membership.agencyId).maybeSingle(),
  ]);
  const financials = await getContractFinancials(supabase, ctx.membership.agencyId, contractId);
  if (!financials) return { error: "Totaux financiers introuvables." };
  if (financials.amountDue > 0.01) return { error: "Le solde financier du contrat doit être réglé avant la clôture." };
  if (deposit && Number(deposit.required_amount) > 0 && !["REFUNDED", "CLOSED"].includes(deposit.status)) return { error: "Finalisez la caution avant la clôture du contrat." };
  if (contract.start_mileage !== null && parsed.data.end_mileage !== undefined && parsed.data.end_mileage < contract.start_mileage) {
    return { error: "Le kilométrage de retour ne peut pas être inférieur au kilométrage de départ." };
  }
  // A destination-branch check-in is authoritative for one-way rentals.
  // Persist that branch during closure, even when check-in was recorded by a
  // branch-limited employee who cannot update the pickup-branch contract row.
  const finalReturnBranchId = checkin?.branch_id ?? contract.return_branch_id ?? contract.branch_id;

  const { error: closeError } = await (supabase as any).rpc("close_contract_atomic", {
    p_agency_id: ctx.membership.agencyId,
    p_contract_id: contractId,
    p_end_mileage: parsed.data.end_mileage ?? null,
    p_fuel_level_end: parsed.data.fuel_level_end ?? null,
  });
  if (closeError) {
    const message = /balance_unsettled/i.test(closeError.message)
      ? "Le solde financier du contrat doit être réglé avant la clôture."
      : /deposit_unsettled/i.test(closeError.message)
        ? "Finalisez la caution avant la clôture du contrat."
        : /one_way_close_requires_manager|permission_denied/i.test(closeError.message)
          ? "Un responsable autorisé doit clôturer cette location."
          : "Impossible de clôturer la location. Réessayez.";
    return { error: message };
  }

  await logAudit(supabase, {
    agencyId: ctx.membership.agencyId,
    actorId: ctx.user.id,
    action: "CONTRACT_CLOSED",
    entityType: "contract",
    entityId: contractId,
    metadata: { endMileage: parsed.data.end_mileage ?? null, fuelLevelEnd: parsed.data.fuel_level_end ?? null, returnBranchId: finalReturnBranchId },
  });

  revalidatePath("/agency/contracts");
  revalidatePath(`/agency/contracts/${contractId}`);
  endPerf();
  return { ok: true };
}

const earlyReturnSchema = z.object({
  contract_id: z.string().uuid(),
  decision: z.enum(["NO_REFUND", "RECALCULATE", "PARTIAL_REFUND"]),
  refund_amount: z.coerce.number().positive().optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional(),
});

/** Record the manager's policy decision for a return before the planned end. */
export async function decideEarlyReturn(_prev: { error?: string; success?: boolean }, formData: FormData) {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER"]);
  const parsed = earlyReturnSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Décision de retour anticipé invalide." };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc("decide_early_return_atomic", {
    p_agency_id: ctx.membership.agencyId,
    p_contract_id: d.contract_id,
    p_decision: d.decision,
    p_refund_amount: d.refund_amount === "" || d.refund_amount === undefined ? 0 : Number(d.refund_amount),
    p_refund_method: "TRANSFER",
    p_note: d.note || null,
  });
  if (error) {
    const message = /early_return_refund_exceeds_paid/i.test(error.message)
      ? "Le remboursement dépasse les paiements disponibles du contrat."
      : /early_return_refund_permission_denied|permission_denied/i.test(error.message)
        ? "La permission de remboursement est requise pour cette décision."
        : /not_an_early_return/i.test(error.message)
          ? "Aucun retour anticipé finalisé à traiter."
          : /decision_conflict|idempotency_conflict/i.test(error.message)
            ? "Une décision de retour anticipé existe déjà avec d’autres paramètres."
            : "Impossible d’enregistrer la décision de retour anticipé.";
    return { error: message };
  }
  revalidatePath(`/agency/contracts/${d.contract_id}`);
  return { success: true };
}

export async function setContractStatus(contractId: string, status: Enums<"contract_status">) {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, status, signed_at, vehicle_id, reservation_id, start_date, end_date, start_at, end_at")
    .eq("id", contractId)
    .eq("agency_id", ctx.membership.agencyId)
    .maybeSingle();
  if (!contract) return { error: "Contrat introuvable." };
  if (contract.status === status) return { ok: true };

  const allowed: Record<Enums<"contract_status">, Enums<"contract_status">[]> = {
    DRAFT: ["ACTIVE", "CANCELLED"],
    ACTIVE: ["CANCELLED"],
    CLOSED: [],
    CANCELLED: [],
  };
  if (!allowed[contract.status].includes(status)) return { error: `Transition impossible : ${contract.status} → ${status}.` };

  if (status === "ACTIVE") {
    try {
      if (await hasContractOverlap(supabase, ctx.membership.agencyId, contract.vehicle_id, contract.start_date, contract.end_date, contract.id, contract.start_at, contract.end_at)) {
        return { error: "Ce véhicule a déjà un contrat actif sur cette période." };
      }
      if (await hasReservationOverlap(supabase, ctx.membership.agencyId, contract.vehicle_id, contract.start_date, contract.end_date, contract.reservation_id || undefined, contract.start_at, contract.end_at)) {
        return { error: "Ce véhicule est déjà réservé sur cette période." };
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Impossible de vérifier la disponibilité." };
    }
  }

  const { error } = await supabase
    .from("contracts")
    .update({ status, signed_at: status === "ACTIVE" ? new Date().toISOString() : null })
    .eq("id", contractId)
    .eq("agency_id", ctx.membership.agencyId);
  if (error) return { error: error.message };

  if (status === "ACTIVE" && contract.reservation_id) {
    const { error: reservationError } = await supabase
      .from("reservations")
      .update({ status: "ONGOING" })
      .eq("id", contract.reservation_id)
      .eq("agency_id", ctx.membership.agencyId);
    if (reservationError) {
      await supabase.from("contracts").update({ status: contract.status, signed_at: contract.signed_at }).eq("id", contractId).eq("agency_id", ctx.membership.agencyId);
      return { error: reservationError.message };
    }
  }

  if (status === "CANCELLED" && contract.reservation_id) {
    const { error: reservationError } = await supabase
      .from("reservations")
      .update({ status: "CANCELLED" })
      .eq("id", contract.reservation_id)
      .eq("agency_id", ctx.membership.agencyId)
      .in("status", ["PENDING", "CONFIRMED", "ONGOING"]);
    if (reservationError) {
      await supabase.from("contracts").update({ status: contract.status, signed_at: contract.signed_at }).eq("id", contractId).eq("agency_id", ctx.membership.agencyId);
      return { error: reservationError.message };
    }
  }

  try {
    await syncVehicleStatus(supabase, ctx.membership.agencyId, contract.vehicle_id);
  } catch (syncError) {
    await supabase.from("contracts").update({ status: contract.status, signed_at: contract.signed_at }).eq("id", contractId).eq("agency_id", ctx.membership.agencyId);
    return { error: syncError instanceof Error ? syncError.message : "Impossible de synchroniser le véhicule." };
  }

  await logAudit(supabase, {
    agencyId: ctx.membership.agencyId,
    actorId: ctx.user.id,
    action: "CONTRACT_STATUS_CHANGED",
    entityType: "contract",
    entityId: contractId,
    metadata: { from: contract.status, to: status },
  });

  revalidatePath("/agency/contracts");
  revalidatePath(`/agency/contracts/${contractId}`);
  return { ok: true };
}
