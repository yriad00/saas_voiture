"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";
import { getAgencyEntitlements } from "@/lib/services/entitlements";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import type { Enums } from "@/lib/database.types";

const vehicleSchema = z.object({
  branch_id: z.string().uuid().optional().or(z.literal("")),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  year: z.coerce.number().int().min(1990).max(2100),
  color: z.string().optional(),
  license_plate: z.string().min(1, "License plate is required"),
  vin: z.string().optional(),
  category: z.string().min(1).default("sedan"),
  seats: z.coerce.number().int().min(1).max(50).default(5),
  doors: z.coerce.number().int().min(1).max(10).default(4),
  fuel_type: z.enum(["GASOLINE", "DIESEL", "ELECTRIC", "HYBRID", "LPG"]).default("GASOLINE"),
  transmission: z.enum(["MANUAL", "AUTOMATIC"]).default("MANUAL"),
  daily_rate: z.coerce.number().min(0).default(0),
  weekly_rate: z.coerce.number().min(0).default(0),
  monthly_rate: z.coerce.number().min(0).default(0),
  deposit_amount: z.coerce.number().min(0).default(0),
  ownership_type: z.enum(["OWNED", "LEASING", "SUBLEASE"]).default("OWNED"),
  owner_name: z.string().trim().max(160).optional().or(z.literal("")),
  owner_phone: z.string().trim().max(40).optional().or(z.literal("")),
  owner_cost_per_day: z.coerce.number().min(0).default(0),
  owner_cost_type: z.enum(["FIXED_DAILY", "PERCENT_REVENUE"]).default("FIXED_DAILY"),
  owner_notes: z.string().trim().max(1000).optional().or(z.literal("")),
  mileage: z.coerce.number().int().min(0).default(0),
  insurance_expiry: z.string().optional(),
  technical_inspection_expiry: z.string().optional(),
  registration_date: z.string().optional(),
  notes: z.string().optional(),
  gps_enabled: z.preprocess((value) => value === "true" || value === "on", z.boolean()).default(false),
  gps_provider: z.string().trim().optional().or(z.literal("")),
  gps_device_id: z.string().trim().optional().or(z.literal("")),
  gps_tracking_url: z.string().url("Lien de suivi GPS invalide").optional().or(z.literal("")),
});

export type VehicleFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
};

export async function createVehicle(
  _prev: VehicleFormState,
  formData: FormData,
): Promise<VehicleFormState> {
  const ctx = await requireAgencyPermission("vehicles.create", ["AGENCY_OWNER", "MANAGER", "AGENT"]);

  const raw = Object.fromEntries(formData);
  const parsed = vehicleSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { error: "Veuillez corriger les champs en surbrillance.", fieldErrors };
  }
  const d = parsed.data;
  const branchId = d.branch_id || ctx.membership.branchId || null;

  const supabase = await createClient();
  if (!(await consumeRateLimit(supabase, "vehicles.create", 30, 60))) {
    return { error: "Trop de créations de véhicules. Réessayez dans une minute." };
  }
  const entitlements = await getAgencyEntitlements(supabase, ctx.membership.agencyId);
  if (entitlements.maxVehicles !== null && entitlements.currentVehicles >= entitlements.maxVehicles) {
    return { error: "La limite de véhicules de votre abonnement est atteinte." };
  }
  const { error } = await (supabase as any).from("vehicles").insert({
    agency_id: ctx.membership.agencyId,
    branch_id: branchId,
    brand: d.brand,
    model: d.model,
    year: d.year,
    color: d.color || null,
    license_plate: d.license_plate,
    vin: d.vin || null,
    category: d.category,
    seats: d.seats,
    doors: d.doors,
    fuel_type: d.fuel_type,
    transmission: d.transmission,
    daily_rate: d.daily_rate,
    weekly_rate: d.weekly_rate,
    monthly_rate: d.monthly_rate,
    deposit_amount: d.deposit_amount,
    ownership_type: d.ownership_type,
    owner_name: d.owner_name || null,
    owner_phone: d.owner_phone || null,
    owner_cost_per_day: d.owner_cost_per_day,
    owner_cost_type: d.owner_cost_type,
    owner_notes: d.owner_notes || null,
    mileage: d.mileage,
    insurance_expiry: d.insurance_expiry || null,
    technical_inspection_expiry: d.technical_inspection_expiry || null,
    registration_date: d.registration_date || null,
    notes: d.notes || null,
    gps_enabled: d.gps_enabled,
    gps_provider: d.gps_provider || null,
    gps_device_id: d.gps_device_id || null,
    gps_tracking_url: d.gps_tracking_url || null,
  });

  if (error) {
    if (error.message.includes("vehicles_plate_agency_unique")) {
      return { error: "Un véhicule avec cette immatriculation existe déjà.", fieldErrors: { license_plate: "Immatriculation déjà utilisée" } };
    }
    return { error: error.message };
  }

  revalidatePath("/agency/fleet");
  return { success: true };
}

export async function updateVehicle(
  vehicleId: string,
  _prev: VehicleFormState,
  formData: FormData,
): Promise<VehicleFormState> {
  const ctx = await requireAgencyPermission("vehicles.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);

  const raw = Object.fromEntries(formData);
  const parsed = vehicleSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { error: "Veuillez corriger les champs en surbrillance.", fieldErrors };
  }
  const d = parsed.data;
  const branchId = d.branch_id || ctx.membership.branchId || null;

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("vehicles")
    .update({
      branch_id: branchId,
      brand: d.brand,
      model: d.model,
      year: d.year,
      color: d.color || null,
      license_plate: d.license_plate,
      vin: d.vin || null,
      category: d.category,
      seats: d.seats,
      doors: d.doors,
      fuel_type: d.fuel_type,
      transmission: d.transmission,
      daily_rate: d.daily_rate,
      weekly_rate: d.weekly_rate,
      monthly_rate: d.monthly_rate,
      deposit_amount: d.deposit_amount,
      ownership_type: d.ownership_type,
      owner_name: d.owner_name || null,
      owner_phone: d.owner_phone || null,
      owner_cost_per_day: d.owner_cost_per_day,
      owner_cost_type: d.owner_cost_type,
      owner_notes: d.owner_notes || null,
      mileage: d.mileage,
      insurance_expiry: d.insurance_expiry || null,
      technical_inspection_expiry: d.technical_inspection_expiry || null,
      registration_date: d.registration_date || null,
      notes: d.notes || null,
      gps_enabled: d.gps_enabled,
      gps_provider: d.gps_provider || null,
      gps_device_id: d.gps_device_id || null,
      gps_tracking_url: d.gps_tracking_url || null,
    })
    .eq("id", vehicleId)
    .eq("agency_id", ctx.membership.agencyId);

  if (error) {
    if (error.message.includes("vehicles_plate_agency_unique")) {
      return { error: "Un véhicule avec cette immatriculation existe déjà.", fieldErrors: { license_plate: "Immatriculation déjà utilisée" } };
    }
    return { error: error.message };
  }

  revalidatePath("/agency/fleet");
  revalidatePath(`/agency/fleet/${vehicleId}`);
  return { success: true };
}

export async function setVehicleStatus(vehicleId: string, status: Enums<"vehicle_status">) {
  const ctx = await requireAgencyPermission("vehicles.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const supabase = await createClient();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, status")
    .eq("id", vehicleId)
    .eq("agency_id", ctx.membership.agencyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!vehicle) return { error: "Véhicule introuvable." };

  const [{ data: activeContract }, { data: activeReservation }] = await Promise.all([
    supabase.from("contracts").select("id").eq("agency_id", ctx.membership.agencyId).eq("vehicle_id", vehicleId).eq("status", "ACTIVE").limit(1),
    supabase.from("reservations").select("id").eq("agency_id", ctx.membership.agencyId).eq("vehicle_id", vehicleId).in("status", ["CONFIRMED", "ONGOING"]).limit(1),
  ]);
  if ((activeContract?.length || activeReservation?.length) && !["RENTED", "RESERVED"].includes(status)) {
    return { error: "Ce véhicule est actuellement affecté à une location active." };
  }

  const { error } = await supabase
    .from("vehicles")
    .update({ status })
    .eq("id", vehicleId)
    .eq("agency_id", ctx.membership.agencyId);

  if (error) return { error: error.message };

  revalidatePath("/agency/fleet");
  revalidatePath(`/agency/fleet/${vehicleId}`);
  return { ok: true };
}

export async function deleteVehicle(vehicleId: string) {
  const ctx = await requireAgencyPermission("vehicles.delete", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("vehicles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", vehicleId)
    .eq("agency_id", ctx.membership.agencyId);

  if (error) return { error: error.message };

  revalidatePath("/agency/fleet");
  return { ok: true };
}
