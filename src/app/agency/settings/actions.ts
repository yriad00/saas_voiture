"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";

const schema = z.object({
  name: z.string().min(2, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
  default_deposit: z.coerce.number().min(0).default(0),
  deposit_required: z.preprocess((value) => value === "true" || value === "on", z.boolean()).default(false),
  cancellation_policy: z.string().optional(),
  late_return_policy: z.string().optional(),
  fuel_policy: z.string().optional(),
  mileage_policy: z.enum(["UNLIMITED", "LIMITED", "UNSPECIFIED"]).default("UNLIMITED"),
  mileage_allowance: z.coerce.number().int().min(0).optional().or(z.literal("")),
  extra_mileage_rate: z.coerce.number().min(0).default(2),
  fuel_shortfall_rate: z.coerce.number().min(0).default(100),
  cleaning_fee: z.coerce.number().min(0).default(200),
  tax_id: z.string().optional(),
  professional_tax_id: z.string().optional(),
  ice: z.string().optional(),
  rc_number: z.string().optional(),
  invoice_footer: z.string().optional(),
  contract_terms_fr: z.string().max(12000).optional(),
  contract_terms_ar: z.string().max(12000).optional(),
});

export type SettingsFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
};

export async function updateAgencySettings(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const ctx = await requireAgencyPermission("settings.update", ["AGENCY_OWNER", "MANAGER"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
    return { error: "Veuillez corriger les champs.", fieldErrors: fe };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const agencyId = ctx.membership.agencyId;
  const { data: currentSettings } = await supabase
    .from("agency_settings")
    .select("extra")
    .eq("agency_id", agencyId)
    .maybeSingle();
  const existingExtra = (currentSettings?.extra ?? {}) as Record<string, unknown>;

  const settingsPayload = {
    tax_rate: d.tax_rate,
    default_deposit: d.default_deposit,
    deposit_required: d.deposit_required,
    cancellation_policy: d.cancellation_policy || null,
    late_return_policy: d.late_return_policy || null,
    fuel_policy: d.fuel_policy || null,
    mileage_policy: d.mileage_policy,
    mileage_allowance: d.mileage_allowance === "" ? null : d.mileage_allowance ?? null,
    extra_mileage_rate: d.extra_mileage_rate,
    fuel_shortfall_rate: d.fuel_shortfall_rate,
    cleaning_fee: d.cleaning_fee,
    extra: {
      ...existingExtra,
      tax_id: d.tax_id || null,
      professional_tax_id: d.professional_tax_id || null,
      ice: d.ice || null,
      rc_number: d.rc_number || null,
      invoice_footer: d.invoice_footer || null,
      contract_terms_fr: d.contract_terms_fr || null,
      contract_terms_ar: d.contract_terms_ar || null,
    },
  };

  // agency_settings is provisioned when the agency is created. Updating the
  // existing row avoids an INSERT RLS check during upsert (which previously
  // made a valid owner change look like it had failed).
  let settingsErr = null;
  if (currentSettings) {
    const result = await supabase
      .from("agency_settings")
      .update(settingsPayload)
      .eq("agency_id", agencyId);
    settingsErr = result.error;
  } else {
    const result = await supabase
      .from("agency_settings")
      .insert({ agency_id: agencyId, ...settingsPayload });
    settingsErr = result.error;
  }
  if (settingsErr) return { error: settingsErr.message };

  const { error: agencyErr } = await supabase
    .from("agencies")
    .update({
      name: d.name,
      email: d.email || null,
      phone: d.phone || null,
      address: d.address || null,
      city: d.city || null,
      country: d.country || null,
    })
    .eq("id", agencyId);
  if (agencyErr) return { error: agencyErr.message };

  revalidatePath("/agency/settings");
  revalidatePath("/agency");
  return { success: true };
}
