import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const ACTIVE_RESERVATION_STATUSES = ["PENDING", "CONFIRMED", "ONGOING"] as const;

function datePart(value: string) {
  return value.slice(0, 10);
}

function dateOnlyEnd(startDate: string, endDate: string) {
  if (datePart(startDate) !== datePart(endDate)) return new Date(`${datePart(endDate)}T00:00:00.000Z`);
  const next = new Date(`${datePart(endDate)}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function rangeFor(startDate: string, endDate: string, startAt?: string | null, endAt?: string | null) {
  const start = startAt ? new Date(startAt) : new Date(`${datePart(startDate)}T00:00:00.000Z`);
  const end = endAt ? new Date(endAt) : dateOnlyEnd(startDate, endDate);
  return { start, end };
}

function overlaps(
  row: { start_date: string; end_date: string; start_at?: string | null; end_at?: string | null; pickup_at?: string | null; return_at?: string | null },
  requested: { start: Date; end: Date },
  startAtKey: "start_at" | "pickup_at",
  endAtKey: "end_at" | "return_at",
) {
  const existing = rangeFor(row.start_date, row.end_date, row[startAtKey] ?? null, row[endAtKey] ?? null);
  return existing.start < requested.end && existing.end > requested.start;
}

/**
 * Date ranges use an exclusive end. This permits a vehicle to be returned and
 * collected again on the same calendar boundary without an artificial clash.
 */
export async function hasReservationOverlap(
  supabase: SupabaseClient,
  agencyId: string,
  vehicleId: string,
  startDate: string,
  endDate: string,
  excludeReservationId?: string,
  startAt?: string | null,
  endAt?: string | null,
) {
  const requested = rangeFor(startDate, endDate, startAt, endAt);
  let query = supabase
    .from("reservations")
    .select("id, start_date, end_date, pickup_at, return_at")
    .eq("agency_id", agencyId)
    .eq("vehicle_id", vehicleId)
    .in("status", [...ACTIVE_RESERVATION_STATUSES])
    .lte("start_date", datePart(endDate))
    .gte("end_date", datePart(startDate));

  if (excludeReservationId) query = query.neq("id", excludeReservationId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).some((row) => overlaps(row, requested, "pickup_at", "return_at"));
}

export async function hasContractOverlap(
  supabase: SupabaseClient,
  agencyId: string,
  vehicleId: string,
  startDate: string,
  endDate: string,
  excludeContractId?: string,
  startAt?: string | null,
  endAt?: string | null,
) {
  const requested = rangeFor(startDate, endDate, startAt, endAt);
  let query = supabase
    .from("contracts")
    .select("id, start_date, end_date, start_at, end_at")
    .eq("agency_id", agencyId)
    .eq("vehicle_id", vehicleId)
    .eq("status", "ACTIVE")
    .lte("start_date", datePart(endDate))
    .gte("end_date", datePart(startDate));
  if (excludeContractId) query = query.neq("id", excludeContractId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).some((row) => overlaps(row, requested, "start_at", "end_at"));
}

export async function syncVehicleStatus(
  supabase: SupabaseClient,
  agencyId: string,
  vehicleId: string,
) {
  const [{ data: vehicle, error: vehicleError }, { data: activeContract, error: contractError }, { data: ongoingReservation, error: reservationError }, { data: confirmedReservation, error: confirmedReservationError }, { data: maintenance, error: maintenanceError }, { data: block, error: blockError }, { data: transfer, error: transferError }, { data: blockingDamage, error: damageError }] = await Promise.all([
    supabase.from("vehicles").select("status").eq("agency_id", agencyId).eq("id", vehicleId).maybeSingle(),
    supabase
      .from("contracts")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("vehicle_id", vehicleId)
      .eq("status", "ACTIVE")
      .limit(1),
    supabase
      .from("reservations")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("vehicle_id", vehicleId)
      .eq("status", "ONGOING")
      .limit(1),
    supabase
      .from("reservations")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("vehicle_id", vehicleId)
      .eq("status", "CONFIRMED")
      .limit(1),
    supabase
      .from("maintenance_records")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("vehicle_id", vehicleId)
      .in("status", ["SCHEDULED", "IN_PROGRESS"])
      .limit(1),
    (supabase as any)
      .from("vehicle_blocks")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("vehicle_id", vehicleId)
      .eq("status", "ACTIVE")
      .lte("start_date", new Date().toISOString().slice(0, 10))
      .gte("end_date", new Date().toISOString().slice(0, 10))
      .limit(1),
    (supabase as any)
      .from("vehicle_transfers")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("vehicle_id", vehicleId)
      .eq("status", "IN_TRANSIT")
      .limit(1),
    (supabase as any)
      .from("damage_records")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("vehicle_id", vehicleId)
      .in("severity", ["MAJOR", "CRITICAL"])
      .not("status", "in", "(REPAIRED,CLOSED)")
      .limit(1),
  ]);

  if (vehicleError) throw vehicleError;
  if (contractError) throw contractError;
  if (reservationError) throw reservationError;
  if (confirmedReservationError) throw confirmedReservationError;
  if (maintenanceError) throw maintenanceError;
  if (blockError) throw blockError;
  if (transferError) throw transferError;
  if (damageError) throw damageError;

  let nextStatus = "AVAILABLE";
  if (activeContract?.length || ongoingReservation?.length) nextStatus = "RENTED";
  else if (confirmedReservation?.length) nextStatus = "RESERVED";
  else if (transfer?.length || block?.length || blockingDamage?.length) nextStatus = "OUT_OF_SERVICE";
  else if (vehicle?.status === "OUT_OF_SERVICE") nextStatus = "OUT_OF_SERVICE";
  else if (maintenance?.length) nextStatus = "MAINTENANCE";

  const { error } = await (supabase as any)
    .from("vehicles")
    .update({ status: nextStatus })
    .eq("agency_id", agencyId)
    .eq("id", vehicleId);
  if (error) throw error;
}
