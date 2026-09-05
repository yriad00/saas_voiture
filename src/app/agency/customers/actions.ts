"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgency } from "@/lib/auth/session";

const customerSchema = z.object({
  first_name: z.string().min(1, "Le prénom est requis"),
  last_name: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
  id_type: z.enum(["CIN", "PASSPORT", "DRIVER_LICENSE", "RESIDENCE_CARD"]).default("CIN"),
  id_number: z.string().optional(),
  driver_license_number: z.string().optional(),
  driver_license_expiry: z.string().optional(),
  date_of_birth: z.string().optional(),
  nationality: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
});

export type CustomerFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
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
    id_type: d.id_type,
    id_number: d.id_number || null,
    driver_license_number: d.driver_license_number || null,
    driver_license_expiry: d.driver_license_expiry || null,
    date_of_birth: d.date_of_birth || null,
    nationality: d.nationality || null,
    address: d.address || null,
    city: d.city || null,
    notes: d.notes || null,
  };
}

function fieldErrors(error: z.ZodError) {
  const fe: Record<string, string> = {};
  for (const issue of error.issues) fe[String(issue.path[0])] = issue.message;
  return fe;
}

export async function createCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = parse(formData);
  if (!parsed.success) return { error: "Veuillez corriger les champs.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
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
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = parse(formData);
  if (!parsed.success) return { error: "Veuillez corriger les champs.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
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
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
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
