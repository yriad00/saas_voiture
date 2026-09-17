"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, requireAgencyPermission } from "@/lib/auth/session";
import { nextReservationReference } from "@/lib/services/reservations";
import { hasReservationOverlap, syncVehicleStatus } from "@/lib/services/availability";
import type { Enums } from "@/lib/database.types";
import { logAudit } from "@/lib/services/audit";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import { calculateRentalQuote } from "@/lib/services/pricing";
import { roundMoney } from "@/lib/utils";
import { measurePerf, startPerf } from "@/lib/perf";
import { moroccoDateTimeLocalToIso } from "@/lib/morocco-time";

const schema = z.object({
  branch_id: z.string().uuid().optional().or(z.literal("")),
  customer_id: z.string().uuid("Sélectionnez un client"),
  vehicle_id: z.string().uuid().optional().or(z.literal("")),
  vehicle_category: z.string().trim().max(80).optional().or(z.literal("")),
  pickup_branch_id: z.string().uuid().optional().or(z.literal("")),
  return_branch_id: z.string().uuid().optional().or(z.literal("")),
  start_date: z.string().min(1, "Date de début requise"),
  end_date: z.string().min(1, "Date de fin requise"),
  pickup_time: z.string().regex(/^\d{2}:\d{2}$/, "Heure de départ invalide").default("10:00"),
  return_time: z.string().regex(/^\d{2}:\d{2}$/, "Heure de retour invalide").default("10:00"),
  daily_rate: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  promotion_code: z.string().max(40).optional(),
  pricing_override_reason: z.string().trim().max(1000).optional(),
  pickup_location: z.string().optional(),
  return_location: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(["WHATSAPP", "PHONE", "INSTAGRAM", "FACEBOOK", "WEBSITE", "WALK_IN", "PARTNER", "OTHER"]).default("OTHER"),
  deposit_amount: z.coerce.number().min(0).default(0),
  advance_amount: z.coerce.number().min(0).default(0),
  one_way_fee: z.coerce.number().min(0).default(0),
}).refine((value) => Boolean(value.vehicle_id || value.vehicle_category), {
  message: "Sélectionnez un véhicule ou une catégorie.",
  path: ["vehicle_id"],
});

export type ReservationFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: { id: string };
};

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

export async function createReservation(
  _prev: ReservationFormState,
  formData: FormData,
): Promise<ReservationFormState> {
  const endPerf = startPerf("createReservation");
  const ctx = await requireAgencyPermission("reservations.create", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
    return { error: "Veuillez corriger les champs.", fieldErrors: fe };
  }
  const d = parsed.data;
  // An explicit pickup branch is authoritative. Never silently move a
  // reservation to the vehicle's current branch: that hides one-way/branch
  // mistakes and can create an operational handover at the wrong location.
  let branchId = d.pickup_branch_id || d.branch_id || ctx.membership.branchId || null;
  const vehicleId = d.vehicle_id || null;

  const start = new Date(d.start_date);
  const end = new Date(d.end_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return { error: "La date de fin doit être postérieure à la date de début.", fieldErrors: { end_date: "Date invalide" } };
  }

  const totalDays = daysBetween(d.start_date, d.end_date);

  let pickupAt: string | null = null;
  let returnAt: string | null = null;
  try {
    pickupAt = moroccoDateTimeLocalToIso(`${d.start_date}T${d.pickup_time}`);
    returnAt = moroccoDateTimeLocalToIso(`${d.end_date}T${d.return_time}`);
  } catch {
    return { error: "La date ou l’heure de réservation est invalide.", fieldErrors: { start_date: "Date/heure invalide" } };
  }
  if (pickupAt && returnAt && new Date(returnAt).getTime() <= new Date(pickupAt).getTime()) {
    return { error: "La restitution doit être après la prise en charge.", fieldErrors: { end_date: "Date/heure invalide" } };
  }

  const supabase = await createClient();
  if (!(await measurePerf("reservation.rateLimit", () => consumeRateLimit(supabase, "reservations.create", 30, 60)))) {
    return { error: "Trop de tentatives de réservation. Réessayez dans une minute." };
  }

  const [{ data: customer }, { data: vehicle }] = await measurePerf("reservation.customerVehicle", () => Promise.all([
    supabase
      .from("customers")
      .select("id")
      .eq("id", d.customer_id)
      .eq("agency_id", ctx.membership.agencyId)
      .is("deleted_at", null)
      .maybeSingle(),
    vehicleId ? supabase
      .from("vehicles")
      .select("id, status, branch_id")
      .eq("id", vehicleId)
      .eq("agency_id", ctx.membership.agencyId)
      .is("deleted_at", null)
      .maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]));
  if (!customer) return { error: "Client introuvable dans cette agence." };
  if (vehicleId && !vehicle) return { error: "Véhicule introuvable dans cette agence." };
  if (vehicle?.branch_id && branchId && vehicle.branch_id !== branchId) {
    return { error: "Le véhicule doit être dans la branche de départ sélectionnée." };
  }
  branchId = vehicle?.branch_id ?? branchId;
  let quote;
  try {
      quote = vehicleId ? await measurePerf("reservation.pricingQuote", () => calculateRentalQuote(supabase, {
      agencyId: ctx.membership.agencyId,
      branchId,
      vehicleId,
      startDate: d.start_date,
      endDate: d.end_date,
      manualDailyRate: d.daily_rate > 0 ? d.daily_rate : undefined,
      manualDiscount: d.discount,
      promotionCode: d.promotion_code?.trim() || undefined,
      canOverrideMinimum: ["AGENCY_OWNER", "MANAGER"].includes(ctx.membership.roleKey),
      })) : {
      days: totalDays,
      baseDailyRate: d.daily_rate,
      dailyRate: d.daily_rate,
      subtotal: Math.max(0, totalDays * d.daily_rate),
      promotionDiscount: 0,
      manualDiscount: d.discount,
      total: Math.max(0, totalDays * d.daily_rate - d.discount),
      minimumDailyRate: 0,
      ruleId: null,
      promotionCode: null,
    };
  } catch (quoteError) {
    return { error: quoteError instanceof Error ? quoteError.message : "Impossible de calculer le tarif." };
  }
  const isPricingOverride = d.daily_rate > 0 && quote.minimumDailyRate > 0 && quote.dailyRate < quote.minimumDailyRate;
  if (isPricingOverride && !d.pricing_override_reason) {
    return { error: "Un motif est obligatoire pour appliquer un tarif inférieur au minimum." };
  }
  const { data: riskFlag } = await measurePerf("reservation.riskFlag", async () => supabase
    .from("customer_risk_flags")
    .select("id, reason")
    .eq("agency_id", ctx.membership.agencyId)
    .eq("customer_id", d.customer_id)
    .eq("status", "OPEN")
    .maybeSingle());
  if (riskFlag && !can(ctx, "customers.blacklist.manage")) {
    return { error: "Ce client est signalé. Un manager doit résoudre le signalement avant toute réservation." };
  }
  if (vehicle && ["OUT_OF_SERVICE", "MAINTENANCE"].includes(vehicle.status)) {
    return { error: "Ce véhicule n'est pas disponible pour une réservation." };
  }

  try {
    if (vehicleId && await measurePerf("reservation.overlap", () => hasReservationOverlap(supabase, ctx.membership.agencyId, vehicleId, d.start_date, d.end_date, undefined, pickupAt, returnAt))) {
      return { error: "Ce véhicule est déjà réservé sur cette période." };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Impossible de vérifier la disponibilité." };
  }

  const reference = await measurePerf("reservation.reference", () => nextReservationReference(ctx.membership.agencyId));
  const depositAmount = Math.max(0, d.deposit_amount);
  const bookingTotal = roundMoney(quote.total + d.one_way_fee);
  const advanceAmount = Math.min(bookingTotal, Math.max(0, d.advance_amount));

  const { data: created, error } = await measurePerf("reservation.insert", async () => (supabase as any)
    .from("reservations")
    .insert({
      agency_id: ctx.membership.agencyId,
      branch_id: branchId,
      customer_id: d.customer_id,
      vehicle_id: vehicleId,
      vehicle_category: d.vehicle_category || null,
      pickup_branch_id: branchId,
      return_branch_id: d.return_branch_id || branchId,
      reference,
      start_date: d.start_date,
      end_date: d.end_date,
      pickup_at: pickupAt,
      return_at: returnAt,
      daily_rate: quote.dailyRate,
      total_days: totalDays,
      discount: quote.manualDiscount + quote.promotionDiscount,
      base_total_amount: quote.total,
      extras_total: 0,
      total_amount: bookingTotal,
      pickup_location: d.pickup_location || null,
      return_location: d.return_location || null,
      notes: d.notes || null,
      source: d.source,
      one_way_fee: d.one_way_fee,
      deposit_amount: depositAmount,
      advance_amount: advanceAmount,
      // This field is the live balance and must reflect money actually
      // received.  `advance_amount` remains the expected advance until a
      // payment is recorded through the payment ledger.
      remaining_amount: bookingTotal,
      status: "CONFIRMED",
      created_by: ctx.user.id,
    })
    .select("id")
    .single());

  if (error || !created) {
    if (error?.message.includes("vehicle_unavailable_during_block")) return { error: "Ce véhicule est bloqué sur cette période." };
    return { error: error?.message ?? "Impossible de créer la réservation." };
  }

  if (isPricingOverride) {
    const { error: historyError } = await supabase.from("pricing_override_history").insert({
      agency_id: ctx.membership.agencyId,
      branch_id: branchId,
      reservation_id: created.id,
      actor_id: ctx.user.id,
      original_daily_rate: quote.baseDailyRate,
      requested_daily_rate: quote.dailyRate,
      minimum_daily_rate: quote.minimumDailyRate,
      discount_amount: quote.manualDiscount,
      reason: d.pricing_override_reason!,
    });
    if (historyError) {
      await supabase.from("reservations").delete().eq("id", created.id).eq("agency_id", ctx.membership.agencyId);
      return { error: "Le dépassement tarifaire n'a pas pu être journalisé." };
    }
  }

  await logAudit(supabase, {
    agencyId: ctx.membership.agencyId,
    branchId,
    actorId: ctx.user.id,
    action: "RESERVATION_CREATED",
    entityType: "reservation",
    entityId: created.id,
    metadata: { reference, vehicleId, vehicleCategory: d.vehicle_category || null, startDate: d.start_date, endDate: d.end_date, pricingRuleId: quote.ruleId, promotionCode: quote.promotionCode, promotionDiscount: quote.promotionDiscount, pricingOverride: isPricingOverride },
  });
  if (riskFlag) {
    await logAudit(supabase, {
      agencyId: ctx.membership.agencyId,
      branchId,
      actorId: ctx.user.id,
      action: "CUSTOMER_RISK_OVERRIDE",
      entityType: "customer",
      entityId: d.customer_id,
      metadata: { riskFlagId: riskFlag.id, reservationId: created.id, reason: riskFlag.reason },
    });
  }

  // The create form renders its success state immediately. Revalidating the
  // sibling list from inside this Server Action would invalidate the whole
  // client flight tree on hosted Next runtimes and can discard that state
  // before the user sees confirmation. The list/detail routes are dynamic and
  // read the new row on navigation, so a broad post-action refresh is not
  // needed here.
  endPerf();
  return { success: { id: created.id } };
}

/** Assign a concrete vehicle to a category-only reservation at the last safe moment. */
export async function assignReservationVehicle(_prev: { error?: string; success?: boolean }, formData: FormData) {
  const ctx = await requireAgencyPermission("reservations.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = z.object({ reservation_id: z.string().uuid(), vehicle_id: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Réservation et véhicule requis." };
  const d = parsed.data;
  const supabase = await createClient();
  const [{ data: reservation }, { data: vehicle }] = await Promise.all([
    (supabase as any).from("reservations").select("id,vehicle_id,vehicle_category,start_date,end_date,pickup_at,return_at,status,branch_id,pickup_branch_id").eq("id", d.reservation_id).eq("agency_id", ctx.membership.agencyId).maybeSingle(),
    supabase.from("vehicles").select("id,status,branch_id,category").eq("id", d.vehicle_id).eq("agency_id", ctx.membership.agencyId).is("deleted_at", null).maybeSingle(),
  ]);
  if (!reservation || !vehicle) return { error: "Réservation ou véhicule introuvable." };
  if (reservation.vehicle_id) return { error: "Un véhicule est déjà attribué à cette réservation." };
  if (!["PENDING", "CONFIRMED"].includes(reservation.status)) return { error: "Cette réservation n'est plus attribuable." };
  if (reservation.vehicle_category && reservation.vehicle_category !== vehicle.category) return { error: "Le véhicule ne correspond pas à la catégorie réservée." };
  if (vehicle.branch_id && reservation.pickup_branch_id && vehicle.branch_id !== reservation.pickup_branch_id) return { error: "Le véhicule doit être dans la branche de départ." };
  if (["OUT_OF_SERVICE", "MAINTENANCE", "RENTED"].includes(vehicle.status)) return { error: "Ce véhicule n'est pas disponible." };
  if (await hasReservationOverlap(supabase, ctx.membership.agencyId, vehicle.id, reservation.start_date, reservation.end_date, undefined, reservation.pickup_at, reservation.return_at)) return { error: "Ce véhicule est déjà réservé sur cette période." };
  const { data: assigned, error } = await (supabase as any).from("reservations").update({ vehicle_id: vehicle.id, branch_id: vehicle.branch_id ?? reservation.branch_id, updated_at: new Date().toISOString() }).eq("id", reservation.id).eq("agency_id", ctx.membership.agencyId).is("vehicle_id", null).select("id").maybeSingle();
  if (error) return { error: error.message };
  if (!assigned) return { error: "Cette réservation a déjà reçu un véhicule. Rechargez la page." };
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, action: "RESERVATION_VEHICLE_ASSIGNED", entityType: "reservation", entityId: reservation.id, metadata: { vehicleId: vehicle.id } });
  revalidatePath(`/agency/reservations/${reservation.id}`);
  revalidatePath("/agency/reservations");
  return { success: true };
}

const STATUSES: Enums<"reservation_status">[] = ["PENDING", "CONFIRMED", "ONGOING", "COMPLETED", "CANCELLED", "NO_SHOW"];

export async function setReservationStatus(
  reservationId: string,
  status: Enums<"reservation_status">,
  reason?: string,
  financial?: { refundAmount?: number; refundMethod?: Enums<"payment_method"> },
) {
  const ctx = await requireAgencyPermission(status === "CANCELLED" ? "reservations.cancel" : "reservations.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  if (!STATUSES.includes(status)) return { error: "Statut invalide" };

  const supabase = await createClient();

  // Fetch the reservation's vehicle to keep vehicle status in sync.
  const { data: res } = await (supabase as any)
    .from("reservations")
    .select("vehicle_id, status, customer_id, branch_id, pickup_branch_id, advance_amount")
    .eq("id", reservationId)
    .eq("agency_id", ctx.membership.agencyId)
    .maybeSingle();

  if (!res) return { error: "Réservation introuvable." };

  const allowed: Record<Enums<"reservation_status">, Enums<"reservation_status">[]> = {
    PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
    CONFIRMED: ["ONGOING", "CANCELLED", "NO_SHOW"],
    ONGOING: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW: [],
  };
  const currentStatus = res.status as Enums<"reservation_status">;
  if (currentStatus === status) return { ok: true };
  if (!allowed[currentStatus].includes(status)) {
    return { error: `Transition impossible : ${currentStatus} → ${status}.` };
  }

  const requestedRefund = Number(financial?.refundAmount ?? 0);
  if (!Number.isFinite(requestedRefund) || requestedRefund < 0) return { error: "Montant de remboursement invalide." };
  const refundMethod = financial?.refundMethod ?? "TRANSFER";
  if (!["CASH", "CARD", "TRANSFER", "CHECK"].includes(refundMethod)) return { error: "Méthode de remboursement invalide." };
  const refundAmount = status === "CANCELLED" || status === "NO_SHOW"
    ? roundMoney(requestedRefund)
    : 0;

  if (status === "CANCELLED" || status === "NO_SHOW") {
    // Reservation outcome, refundable advance and cash movement are committed
    // by one database transaction. This prevents a refund from succeeding
    // while the cancellation/no-show status update fails (or vice versa).
    const { error: outcomeError } = await (supabase as any).rpc("set_reservation_status_financial", {
      p_agency_id: ctx.membership.agencyId,
      p_reservation_id: reservationId,
      p_status: status,
      p_reason: reason || null,
      p_refund_amount: refundAmount,
      p_refund_method: refundMethod,
    });
    if (outcomeError) {
      const message = /refund_exceeds_received/i.test(outcomeError.message)
        ? "Le remboursement dépasse l’avance effectivement reçue pour cette réservation."
        : /permission_denied/i.test(outcomeError.message)
          ? "Vous n’avez pas la permission d’appliquer ce remboursement."
          : "Impossible d’enregistrer l’annulation ou le no-show. Réessayez.";
      return { error: message };
    }
    await logAudit(supabase, {
      agencyId: ctx.membership.agencyId,
      actorId: ctx.user.id,
      action: "RESERVATION_STATUS_CHANGED",
      entityType: "reservation",
      entityId: reservationId,
      metadata: { from: res.status, to: status, refundAmount },
    });
    revalidatePath("/agency/reservations");
    revalidatePath(`/agency/reservations/${reservationId}`);
    return { ok: true };
  }

  const { error } = await (supabase as any)
    .from("reservations")
    .update({ status })
    .eq("id", reservationId)
    .eq("agency_id", ctx.membership.agencyId);
  if (error) return { error: error.message };

  try {
    if (res.vehicle_id) await syncVehicleStatus(supabase, ctx.membership.agencyId, res.vehicle_id);
  } catch (syncError) {
    await (supabase as any)
      .from("reservations")
      .update({ status: res.status })
      .eq("id", reservationId)
      .eq("agency_id", ctx.membership.agencyId);
    return { error: syncError instanceof Error ? syncError.message : "Impossible de synchroniser le véhicule." };
  }

  await logAudit(supabase, {
    agencyId: ctx.membership.agencyId,
    actorId: ctx.user.id,
    action: "RESERVATION_STATUS_CHANGED",
    entityType: "reservation",
    entityId: reservationId,
    metadata: { from: res.status, to: status, refundAmount },
  });

  revalidatePath("/agency/reservations");
  revalidatePath(`/agency/reservations/${reservationId}`);
  return { ok: true };
}
