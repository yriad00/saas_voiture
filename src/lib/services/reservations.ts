import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables, Enums } from "@/lib/database.types";

export type ReservationRow = Tables<"reservations">;

export type ReservationListItem = ReservationRow & {
  customerName: string;
  vehicleLabel: string;
};

export async function listReservations(agencyId: string): Promise<ReservationListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("*, customers!inner(first_name, last_name), vehicles!inner(brand, model, license_plate)")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r) => {
    const c = r.customers as unknown as { first_name: string; last_name: string };
    const v = r.vehicles as unknown as { brand: string; model: string; license_plate: string };
    return {
      ...(r as ReservationRow),
      customerName: `${c.first_name} ${c.last_name}`,
      vehicleLabel: `${v.brand} ${v.model} (${v.license_plate})`,
    };
  });
}

export type ReservationDetail = ReservationRow & {
  customer: { id: string; name: string; phone: string | null; email: string | null };
  vehicle: { id: string; label: string; plate: string };
  hasContract: boolean;
};

export async function getReservation(id: string): Promise<ReservationDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select("*, customers!inner(id, first_name, last_name, phone, email), vehicles!inner(id, brand, model, license_plate)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const c = data.customers as unknown as { id: string; first_name: string; last_name: string; phone: string | null; email: string | null };
  const v = data.vehicles as unknown as { id: string; brand: string; model: string; license_plate: string };

  const { count } = await supabase
    .from("contracts")
    .select("*", { count: "exact", head: true })
    .eq("reservation_id", id);

  return {
    ...(data as ReservationRow),
    customer: { id: c.id, name: `${c.first_name} ${c.last_name}`, phone: c.phone, email: c.email },
    vehicle: { id: v.id, label: `${v.brand} ${v.model}`, plate: v.license_plate },
    hasContract: (count ?? 0) > 0,
  };
}

export type ReservationStats = {
  total: number;
  byStatus: Record<Enums<"reservation_status">, number>;
};

export async function getReservationStats(agencyId: string): Promise<ReservationStats> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select("status")
    .eq("agency_id", agencyId);

  const byStatus: Record<Enums<"reservation_status">, number> = {
    PENDING: 0, CONFIRMED: 0, ONGOING: 0, COMPLETED: 0, CANCELLED: 0,
  };
  for (const r of data ?? []) byStatus[r.status]++;
  return { total: data?.length ?? 0, byStatus };
}

/** Generate the next reservation reference for an agency, e.g. RES-2026-0007. */
export async function nextReservationReference(agencyId: string): Promise<string> {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .eq("agency_id", agencyId);
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  return `RES-${year}-${seq}`;
}
