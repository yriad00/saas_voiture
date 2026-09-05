"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgency } from "@/lib/auth/session";
import { nextReservationReference } from "@/lib/services/reservations";
import type { Enums } from "@/lib/database.types";

const schema = z.object({
  customer_id: z.string().uuid("Sélectionnez un client"),
  vehicle_id: z.string().uuid("Sélectionnez un véhicule"),
  start_date: z.string().min(1, "Date de début requise"),
  end_date: z.string().min(1, "Date de fin requise"),
  daily_rate: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  pickup_location: z.string().optional(),
  return_location: z.string().optional(),
  notes: z.string().optional(),
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
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
    return { error: "Veuillez corriger les champs.", fieldErrors: fe };
  }
  const d = parsed.data;

  if (new Date(d.end_date) < new Date(d.start_date)) {
    return { error: "La date de fin doit être postérieure à la date de début.", fieldErrors: { end_date: "Date invalide" } };
  }

  const totalDays = daysBetween(d.start_date, d.end_date);
  const totalAmount = Math.max(0, totalDays * d.daily_rate - d.discount);

  const supabase = await createClient();
  const reference = await nextReservationReference(ctx.membership.agencyId);

  const { data: created, error } = await supabase
    .from("reservations")
    .insert({
      agency_id: ctx.membership.agencyId,
      customer_id: d.customer_id,
      vehicle_id: d.vehicle_id,
      reference,
      start_date: d.start_date,
      end_date: d.end_date,
      daily_rate: d.daily_rate,
      total_days: totalDays,
      discount: d.discount,
      total_amount: totalAmount,
      pickup_location: d.pickup_location || null,
      return_location: d.return_location || null,
      notes: d.notes || null,
      status: "CONFIRMED",
      created_by: ctx.user.id,
    })
    .select("id")
    .single();

  if (error || !created) return { error: error?.message ?? "Impossible de créer la réservation." };

  revalidatePath("/agency/reservations");
  return { success: { id: created.id } };
}

const STATUSES: Enums<"reservation_status">[] = ["PENDING", "CONFIRMED", "ONGOING", "COMPLETED", "CANCELLED"];

export async function setReservationStatus(reservationId: string, status: Enums<"reservation_status">) {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
  if (!STATUSES.includes(status)) return { error: "Statut invalide" };

  const supabase = await createClient();

  // Fetch the reservation's vehicle to keep vehicle status in sync.
  const { data: res } = await supabase
    .from("reservations")
    .select("vehicle_id")
    .eq("id", reservationId)
    .eq("agency_id", ctx.membership.agencyId)
    .maybeSingle();

  const { error } = await supabase
    .from("reservations")
    .update({ status })
    .eq("id", reservationId)
    .eq("agency_id", ctx.membership.agencyId);
  if (error) return { error: error.message };

  // Sync vehicle status: ONGOING → RENTED, COMPLETED/CANCELLED → AVAILABLE, CONFIRMED → RESERVED.
  if (res?.vehicle_id) {
    const vehicleStatus: Enums<"vehicle_status"> | null =
      status === "ONGOING" ? "RENTED"
      : status === "CONFIRMED" ? "RESERVED"
      : status === "COMPLETED" || status === "CANCELLED" ? "AVAILABLE"
      : null;
    if (vehicleStatus) {
      await supabase.from("vehicles").update({ status: vehicleStatus }).eq("id", res.vehicle_id);
    }
  }

  revalidatePath("/agency/reservations");
  revalidatePath(`/agency/reservations/${reservationId}`);
  return { ok: true };
}
