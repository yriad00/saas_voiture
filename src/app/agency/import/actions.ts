"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgencyPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getAgencyEntitlements } from "@/lib/services/entitlements";

const MAX_IMPORT_ROWS = 500;

export type ImportRowError = { row: number; message: string };

export type ImportResult = {
  imported?: number;
  error?: string;
  rowErrors?: ImportRowError[];
};

const customerInputSchema = z.object({
  first_name: z.string().trim().min(1, "Le prénom est requis"),
  last_name: z.string().trim().min(1, "Le nom est requis"),
  email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  id_type: z.enum(["CIN", "PASSPORT", "DRIVER_LICENSE", "RESIDENCE_CARD"]).default("CIN"),
  id_number: z.string().trim().optional(),
  driver_license_number: z.string().trim().optional(),
  driver_license_expiry: z.string().trim().optional(),
  date_of_birth: z.string().trim().optional(),
  nationality: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const vehicleInputSchema = z.object({
  brand: z.string().trim().min(1, "La marque est requise"),
  model: z.string().trim().min(1, "Le modèle est requis"),
  year: z.coerce.number().int().min(1990, "Année invalide").max(2100, "Année invalide"),
  color: z.string().trim().optional(),
  license_plate: z.string().trim().min(1, "L'immatriculation est requise"),
  vin: z.string().trim().optional(),
  category: z.string().trim().min(1).default("sedan"),
  seats: z.coerce.number().int().min(1).max(50).default(5),
  doors: z.coerce.number().int().min(1).max(10).default(4),
  fuel_type: z.enum(["GASOLINE", "DIESEL", "ELECTRIC", "HYBRID", "LPG"]).default("GASOLINE"),
  transmission: z.enum(["MANUAL", "AUTOMATIC"]).default("MANUAL"),
  daily_rate: z.coerce.number().min(0).default(0),
  mileage: z.coerce.number().int().min(0).default(0),
  insurance_expiry: z.string().trim().optional(),
  technical_inspection_expiry: z.string().trim().optional(),
  registration_date: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  gps_enabled: z.boolean().default(false),
  gps_provider: z.string().trim().optional(),
  gps_device_id: z.string().trim().optional(),
  gps_tracking_url: z.string().url("Lien de suivi GPS invalide").optional().or(z.literal("")),
});

function rowObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeDate(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;

  const ddmmyyyy = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

function numberValue(value: unknown, fallback?: number): unknown {
  const raw = text(value).replace(/\s/g, "").replace(",", ".");
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : value;
}

function enumValue(value: unknown, aliases: Record<string, string>, fallback: string): string {
  const key = text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[\s_-]/g, "");
  return aliases[key] ?? fallback;
}

function customerRow(value: unknown) {
  const row = rowObject(value);
  if (!row) return null;
  return {
    first_name: text(row.first_name),
    last_name: text(row.last_name),
    email: text(row.email),
    phone: text(row.phone),
    id_type: enumValue(row.id_type, {
      CIN: "CIN",
      CNI: "CIN",
      PASSPORT: "PASSPORT",
      PASSEPORT: "PASSPORT",
      DRIVERLICENSE: "DRIVER_LICENSE",
      PERMIS: "DRIVER_LICENSE",
      RESIDENCECARD: "RESIDENCE_CARD",
      CARTESEJOUR: "RESIDENCE_CARD",
    }, "CIN"),
    id_number: text(row.id_number),
    driver_license_number: text(row.driver_license_number),
    driver_license_expiry: normalizeDate(row.driver_license_expiry),
    date_of_birth: normalizeDate(row.date_of_birth),
    nationality: text(row.nationality),
    address: text(row.address),
    city: text(row.city),
    notes: text(row.notes),
  };
}

function vehicleRow(value: unknown) {
  const row = rowObject(value);
  if (!row) return null;
  return {
    brand: text(row.brand),
    model: text(row.model),
    year: numberValue(row.year),
    color: text(row.color),
    license_plate: text(row.license_plate).toUpperCase(),
    vin: text(row.vin),
    category: text(row.category) || "sedan",
    seats: numberValue(row.seats, 5),
    doors: numberValue(row.doors, 4),
    fuel_type: enumValue(row.fuel_type, {
      GASOLINE: "GASOLINE",
      ESSENCE: "GASOLINE",
      DIESEL: "DIESEL",
      ELECTRIC: "ELECTRIC",
      ELECTRIQUE: "ELECTRIC",
      HYBRID: "HYBRID",
      HYBRIDE: "HYBRID",
      LPG: "LPG",
      GPL: "LPG",
    }, "GASOLINE"),
    transmission: enumValue(row.transmission, {
      MANUAL: "MANUAL",
      MANUELLE: "MANUAL",
      AUTOMATIC: "AUTOMATIC",
      AUTOMATIQUE: "AUTOMATIC",
    }, "MANUAL"),
    daily_rate: numberValue(row.daily_rate, 0),
    mileage: numberValue(row.mileage, 0),
    insurance_expiry: normalizeDate(row.insurance_expiry),
    technical_inspection_expiry: normalizeDate(row.technical_inspection_expiry),
    registration_date: normalizeDate(row.registration_date),
    notes: text(row.notes),
    gps_enabled: ["true", "1", "yes", "oui", "on"].includes(text(row.gps_enabled).toLowerCase()),
    gps_provider: text(row.gps_provider),
    gps_device_id: text(row.gps_device_id),
    gps_tracking_url: text(row.gps_tracking_url),
  };
}

export async function importCustomers(rows: unknown[]): Promise<ImportResult> {
  const ctx = await requireAgencyPermission("customers.create", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Le fichier ne contient aucune ligne." };
  if (rows.length > MAX_IMPORT_ROWS) return { error: `Le fichier est limité à ${MAX_IMPORT_ROWS} lignes par import.` };

  const rowErrors: ImportRowError[] = [];
  const values: Array<z.infer<typeof customerInputSchema>> = [];
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();

  rows.forEach((value, index) => {
    const parsed = customerInputSchema.safeParse(customerRow(value));
    const rowNumber = index + 2;
    if (!parsed.success) {
      rowErrors.push({ row: rowNumber, message: parsed.error.issues.map((issue) => issue.message).join(" · ") });
      return;
    }
    const phone = parsed.data.phone?.replace(/\s/g, "").toLowerCase();
    const email = parsed.data.email?.toLowerCase();
    if (phone && seenPhones.has(phone)) {
      rowErrors.push({ row: rowNumber, message: "Téléphone déjà présent dans le fichier." });
      return;
    }
    if (email && seenEmails.has(email)) {
      rowErrors.push({ row: rowNumber, message: "Email déjà présent dans le fichier." });
      return;
    }
    if (phone) seenPhones.add(phone);
    if (email) seenEmails.add(email);
    values.push(parsed.data);
  });

  if (rowErrors.length) return { error: "Certaines lignes doivent être corrigées avant l'import.", rowErrors };

  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert(values.map((value) => ({
    agency_id: ctx.membership.agencyId,
    first_name: value.first_name,
    last_name: value.last_name,
    email: value.email || null,
    phone: value.phone || null,
    id_type: value.id_type,
    id_number: value.id_number || null,
    driver_license_number: value.driver_license_number || null,
    driver_license_expiry: value.driver_license_expiry || null,
    date_of_birth: value.date_of_birth || null,
    nationality: value.nationality || null,
    address: value.address || null,
    city: value.city || null,
    notes: value.notes || null,
  })));

  if (error) return { error: error.message };
  revalidatePath("/agency/customers");
  revalidatePath("/agency/reservations/new");
  return { imported: values.length };
}

export async function importVehicles(rows: unknown[]): Promise<ImportResult> {
  const ctx = await requireAgencyPermission("vehicles.create", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Le fichier ne contient aucune ligne." };
  if (rows.length > MAX_IMPORT_ROWS) return { error: `Le fichier est limité à ${MAX_IMPORT_ROWS} lignes par import.` };

  const rowErrors: ImportRowError[] = [];
  const values: Array<z.infer<typeof vehicleInputSchema>> = [];
  const seenPlates = new Set<string>();

  rows.forEach((value, index) => {
    const parsed = vehicleInputSchema.safeParse(vehicleRow(value));
    const rowNumber = index + 2;
    if (!parsed.success) {
      rowErrors.push({ row: rowNumber, message: parsed.error.issues.map((issue) => issue.message).join(" · ") });
      return;
    }
    const plate = parsed.data.license_plate.replace(/\s/g, "").toUpperCase();
    if (seenPlates.has(plate)) {
      rowErrors.push({ row: rowNumber, message: "Immatriculation déjà présente dans le fichier." });
      return;
    }
    seenPlates.add(plate);
    values.push({ ...parsed.data, license_plate: plate });
  });

  if (rowErrors.length) return { error: "Certaines lignes doivent être corrigées avant l'import.", rowErrors };

  const supabase = await createClient();
  const { data: existingVehicles, error: existingError } = await supabase
    .from("vehicles")
    .select("license_plate")
    .eq("agency_id", ctx.membership.agencyId)
    .is("deleted_at", null);
  if (existingError) return { error: existingError.message };

  const existingPlates = new Set((existingVehicles ?? []).map((vehicle) => vehicle.license_plate.replace(/\s/g, "").toUpperCase()));
  const existingConflicts = values
    .map((value, index) => ({ value, row: index + 2 }))
    .filter(({ value }) => existingPlates.has(value.license_plate.replace(/\s/g, "").toUpperCase()));
  if (existingConflicts.length) {
    return {
      error: "Certaines immatriculations existent déjà dans votre flotte.",
      rowErrors: existingConflicts.map(({ value, row }) => ({ row, message: `L'immatriculation ${value.license_plate} existe déjà.` })),
    };
  }

  const entitlements = await getAgencyEntitlements(supabase, ctx.membership.agencyId);
  if (entitlements.maxVehicles !== null && entitlements.currentVehicles + values.length > entitlements.maxVehicles) {
    return { error: `Votre abonnement autorise ${entitlements.maxVehicles} véhicule(s). Il vous reste ${Math.max(entitlements.maxVehicles - entitlements.currentVehicles, 0)} place(s).` };
  }

  const { error } = await supabase.from("vehicles").insert(values.map((value) => ({
    agency_id: ctx.membership.agencyId,
    brand: value.brand,
    model: value.model,
    year: value.year,
    color: value.color || null,
    license_plate: value.license_plate,
    vin: value.vin || null,
    category: value.category,
    seats: value.seats,
    doors: value.doors,
    fuel_type: value.fuel_type,
    transmission: value.transmission,
    daily_rate: value.daily_rate,
    mileage: value.mileage,
    status: "AVAILABLE",
    insurance_expiry: value.insurance_expiry || null,
    technical_inspection_expiry: value.technical_inspection_expiry || null,
    registration_date: value.registration_date || null,
    notes: value.notes || null,
    gps_enabled: value.gps_enabled,
    gps_provider: value.gps_provider || null,
    gps_device_id: value.gps_device_id || null,
    gps_tracking_url: value.gps_tracking_url || null,
  })));

  if (error) return { error: error.message };
  revalidatePath("/agency/fleet");
  revalidatePath("/agency/reservations/new");
  return { imported: values.length };
}
