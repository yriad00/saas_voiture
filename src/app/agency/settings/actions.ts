"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgency } from "@/lib/auth/session";

const schema = z.object({
  name: z.string().min(2, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
  default_deposit: z.coerce.number().min(0).default(0),
  deposit_required: z.coerce.boolean().default(false),
  cancellation_policy: z.string().optional(),
  late_return_policy: z.string().optional(),
  fuel_policy: z.string().optional(),
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
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
    return { error: "Veuillez corriger les champs.", fieldErrors: fe };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const agencyId = ctx.membership.agencyId;

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

  const { error: settingsErr } = await supabase
    .from("agency_settings")
    .upsert({
      agency_id: agencyId,
      tax_rate: d.tax_rate,
      default_deposit: d.default_deposit,
      deposit_required: d.deposit_required,
      cancellation_policy: d.cancellation_policy || null,
      late_return_policy: d.late_return_policy || null,
      fuel_policy: d.fuel_policy || null,
    });
  if (settingsErr) return { error: settingsErr.message };

  revalidatePath("/agency/settings");
  revalidatePath("/agency");
  return { success: true };
}
