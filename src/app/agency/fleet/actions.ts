"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgency } from "@/lib/auth/session";
import type { Enums } from "@/lib/database.types";

const vehicleSchema = z.object({
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
  mileage: z.coerce.number().int().min(0).default(0),
  insurance_expiry: z.string().optional(),
  technical_inspection_expiry: z.string().optional(),
  registration_date: z.string().optional(),
  notes: z.string().optional(),
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
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);

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

  const supabase = await createClient();
  const { error } = await supabase.from("vehicles").insert({
    agency_id: ctx.membership.agencyId,
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
    mileage: d.mileage,
    insurance_expiry: d.insurance_expiry || null,
    technical_inspection_expiry: d.technical_inspection_expiry || null,
    registration_date: d.registration_date || null,
    notes: d.notes || null,
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
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);

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

  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicles")
    .update({
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
      mileage: d.mileage,
      insurance_expiry: d.insurance_expiry || null,
      technical_inspection_expiry: d.technical_inspection_expiry || null,
      registration_date: d.registration_date || null,
      notes: d.notes || null,
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
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const supabase = await createClient();

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
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
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
