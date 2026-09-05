"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/session";
import { slugify } from "@/lib/utils";
import type { Enums } from "@/lib/database.types";

const createSchema = z.object({
  name: z.string().min(2, "Agency name is required"),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Slug may contain only lowercase letters, numbers and dashes"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().min(1).default("MAD"),
  timezone: z.string().min(1).default("Africa/Casablanca"),
  notes: z.string().optional(),
  ownerName: z.string().min(2, "Owner name is required"),
  ownerEmail: z.string().email("Enter a valid owner email"),
  ownerPhone: z.string().optional(),
  planId: z.string().uuid("Select a plan"),
  trial: z.coerce.boolean().default(true),
  endsAt: z.string().optional(),
});

export type CreateAgencyState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: { agencyId: string; ownerEmail: string; tempPassword: string };
};

function tempPassword(): string {
  // 16-char URL-safe password with mixed classes.
  const raw = crypto.randomUUID().replace(/-/g, "");
  return `Fh${raw.slice(0, 10)}!${raw.slice(10, 14).toUpperCase()}`;
}

export async function createAgency(
  _prev: CreateAgencyState,
  formData: FormData,
): Promise<CreateAgencyState> {
  await requireSuperAdmin();

  const raw = Object.fromEntries(formData);
  const parsed = createSchema.safeParse({ ...raw, slug: slugify(String(raw.slug || raw.name || "")) });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }
  const d = parsed.data;

  const admin = createAdminClient();
  const password = tempPassword();

  // 1. Create the owner's auth user (email pre-confirmed; proper email invites arrive once SMTP is set up).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: d.ownerEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: d.ownerName, phone: d.ownerPhone ?? null },
  });
  if (createErr || !created?.user) {
    const msg = createErr?.message?.includes("already been registered")
      ? "That owner email already has an account. Use a different email."
      : createErr?.message ?? "Could not create the owner account.";
    return { error: msg, fieldErrors: { ownerEmail: msg } };
  }
  const ownerId = created.user.id;

  // 2. Ensure owner phone is on the profile (trigger sets name/email from metadata/email).
  if (d.ownerPhone) {
    await admin.from("profiles").update({ phone: d.ownerPhone, full_name: d.ownerName }).eq("id", ownerId);
  }

  // 3. Provision the agency atomically as the super-admin (RPC is SECURITY DEFINER, guarded).
  const status: Enums<"agency_status"> = d.trial ? "TRIAL" : "ACTIVE";
  const supabase = await createClient();
  const { data: agencyId, error: rpcErr } = await supabase.rpc("create_agency_with_owner", {
    p_name: d.name,
    p_slug: d.slug,
    p_owner_profile_id: ownerId,
    p_plan_id: d.planId,
    p_email: d.email || undefined,
    p_phone: d.phone || undefined,
    p_address: d.address || undefined,
    p_city: d.city || undefined,
    p_country: d.country || undefined,
    p_currency: d.currency,
    p_timezone: d.timezone,
    p_status: status,
    p_notes: d.notes || undefined,
    p_trial: d.trial,
    p_ends_at: d.endsAt ? new Date(d.endsAt).toISOString() : undefined,
  });

  if (rpcErr || !agencyId) {
    // Roll back the orphaned auth user so the operation is all-or-nothing.
    await admin.auth.admin.deleteUser(ownerId);
    const msg = rpcErr?.message?.includes("agencies_slug_key")
      ? "That slug is already taken. Choose another."
      : rpcErr?.message ?? "Could not create the agency.";
    return { error: msg, fieldErrors: rpcErr?.message?.includes("slug") ? { slug: msg } : undefined };
  }

  revalidatePath("/super-admin/agencies");
  revalidatePath("/super-admin");
  return { success: { agencyId, ownerEmail: d.ownerEmail, tempPassword: password } };
}

const STATUS_VALUES: Enums<"agency_status">[] = ["ACTIVE", "INACTIVE", "SUSPENDED", "TRIAL", "EXPIRED"];

export async function setAgencyStatus(agencyId: string, status: Enums<"agency_status">) {
  await requireSuperAdmin();
  if (!STATUS_VALUES.includes(status)) return { error: "Invalid status" };

  const supabase = await createClient();
  const { error } = await supabase.from("agencies").update({ status }).eq("id", agencyId);
  if (error) return { error: error.message };

  revalidatePath(`/super-admin/agencies/${agencyId}`);
  revalidatePath("/super-admin/agencies");
  revalidatePath("/super-admin");
  return { ok: true };
}
