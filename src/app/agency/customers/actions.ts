"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const customerSchema = z.object({
  first_name: z.string().min(1, "Le prénom est requis"),
  last_name: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  customer_type: z.enum(["INDIVIDUAL", "COMPANY"]).default("INDIVIDUAL"),
  id_type: z.enum(["CIN", "PASSPORT", "DRIVER_LICENSE", "RESIDENCE_CARD"]).default("CIN"),
  id_number: z.string().optional(),
  driver_license_number: z.string().optional(),
  driver_license_expiry: z.string().optional(),
  driver_license_issued_at: z.string().optional(),
  id_expiry: z.string().optional(),
  passport_expiry: z.string().optional(),
  international_permit_number: z.string().optional(),
  date_of_birth: z.string().optional(),
  nationality: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
  company_name: z.string().optional(),
  ice: z.string().optional(),
  if_number: z.string().optional(),
  rc_number: z.string().optional(),
  contact_person: z.string().optional(),
});

const quickCustomerSchema = z.object({
  quick_first_name: z.string().trim().min(1, "Le prénom est requis"),
  quick_last_name: z.string().trim().min(1, "Le nom est requis"),
  quick_phone: z.string().trim().min(6, "Le téléphone est requis"),
  quick_email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
});

export type CustomerFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
};

export type QuickCustomer = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
};

export type QuickCustomerFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: QuickCustomer;
};

function parse(formData: FormData) {
  return customerSchema.safeParse(Object.fromEntries(formData));
}

function toRow(d: z.infer<typeof customerSchema>) {
  return {
    first_name: d.first_name,
    last_name: d.last_name,
    email: d.email || null,
    phone: d.phone || null,
    whatsapp: d.whatsapp || null,
    customer_type: d.customer_type,
    id_type: d.id_type,
    id_number: d.id_number || null,
    driver_license_number: d.driver_license_number || null,
    driver_license_expiry: d.driver_license_expiry || null,
    driver_license_issued_at: d.driver_license_issued_at || null,
    id_expiry: d.id_expiry || null,
    passport_expiry: d.passport_expiry || null,
    international_permit_number: d.international_permit_number || null,
    date_of_birth: d.date_of_birth || null,
    nationality: d.nationality || null,
    address: d.address || null,
    city: d.city || null,
    notes: d.notes || null,
    company_name: d.company_name || null,
    ice: d.ice || null,
    if_number: d.if_number || null,
    rc_number: d.rc_number || null,
    contact_person: d.contact_person || null,
  };
}

async function findDuplicateCustomer(supabase: SupabaseClient, agencyId: string, values: { id_number?: string; email?: string; phone?: string }, excludeId?: string) {
  const checks = [
    values.id_number?.trim() ? supabase.from("customers").select("id,first_name,last_name").eq("agency_id", agencyId).eq("id_number", values.id_number.trim()).is("deleted_at", null).maybeSingle() : Promise.resolve({ data: null }),
    values.email?.trim() ? supabase.from("customers").select("id,first_name,last_name").eq("agency_id", agencyId).eq("email", values.email.trim()).is("deleted_at", null).maybeSingle() : Promise.resolve({ data: null }),
  ];
  const matches = await Promise.all(checks);
  const duplicate = matches.map((result) => result.data).find((row) => row && row.id !== excludeId);
  return duplicate ?? null;
}

function fieldErrors(error: z.ZodError) {
  const fe: Record<string, string> = {};
  for (const issue of error.issues) fe[String(issue.path[0])] = issue.message;
  return fe;
}

export async function createQuickCustomer(
  _prev: QuickCustomerFormState,
  formData: FormData,
): Promise<QuickCustomerFormState> {
  const ctx = await requireAgencyPermission("customers.create", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = quickCustomerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Veuillez renseigner le nom et le téléphone.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const duplicate = await findDuplicateCustomer(supabase, ctx.membership.agencyId, { email: parsed.data.quick_email || undefined });
  if (duplicate) return { error: `Un client avec cet email existe déjà : ${duplicate.first_name} ${duplicate.last_name}.` };
  if (parsed.data.quick_phone) {
    const { data: phoneMatch } = await supabase.from("customers").select("id,first_name,last_name").eq("agency_id", ctx.membership.agencyId).eq("phone", parsed.data.quick_phone).is("deleted_at", null).maybeSingle();
    if (phoneMatch) return { error: `Un client avec ce téléphone existe déjà : ${phoneMatch.first_name} ${phoneMatch.last_name}.` };
  }
  const { data, error } = await supabase
    .from("customers")
    .insert({
      agency_id: ctx.membership.agencyId,
      first_name: parsed.data.quick_first_name,
      last_name: parsed.data.quick_last_name,
      phone: parsed.data.quick_phone,
      email: parsed.data.quick_email || null,
    })
    .select("id, first_name, last_name, phone")
    .single();

  if (error || !data) return { error: error?.message ?? "Impossible d'ajouter le client." };

  revalidatePath("/agency/customers");
  revalidatePath("/agency/reservations/new");
  return { success: data };
}

export async function createCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const ctx = await requireAgencyPermission("customers.create", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = parse(formData);
  if (!parsed.success) return { error: "Veuillez corriger les champs.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const duplicate = await findDuplicateCustomer(supabase, ctx.membership.agencyId, { id_number: parsed.data.id_number, email: parsed.data.email });
  if (duplicate) return { error: `Un client avec cette pièce ou cet email existe déjà : ${duplicate.first_name} ${duplicate.last_name}.` };
  const { error } = await supabase.from("customers").insert({
    agency_id: ctx.membership.agencyId,
    ...toRow(parsed.data),
  });
  if (error) return { error: error.message };

  revalidatePath("/agency/customers");
  return { success: true };
}

export async function updateCustomer(
  customerId: string,
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const ctx = await requireAgencyPermission("customers.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = parse(formData);
  if (!parsed.success) return { error: "Veuillez corriger les champs.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const duplicate = await findDuplicateCustomer(supabase, ctx.membership.agencyId, { id_number: parsed.data.id_number, email: parsed.data.email }, customerId);
  if (duplicate) return { error: `Un autre client avec cette pièce ou cet email existe déjà : ${duplicate.first_name} ${duplicate.last_name}.` };
  const { error } = await supabase
    .from("customers")
    .update(toRow(parsed.data))
    .eq("id", customerId)
    .eq("agency_id", ctx.membership.agencyId);
  if (error) return { error: error.message };

  revalidatePath("/agency/customers");
  revalidatePath(`/agency/customers/${customerId}`);
  return { success: true };
}

export async function deleteCustomer(customerId: string) {
  const ctx = await requireAgencyPermission("customers.delete", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", customerId)
    .eq("agency_id", ctx.membership.agencyId);
  if (error) return { error: error.message };

  revalidatePath("/agency/customers");
  return { ok: true };
}
