"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyPermission } from "@/lib/auth/session";
import { getAgencyEntitlements } from "@/lib/services/entitlements";
import { consumeRateLimit } from "@/lib/services/rate-limit";

const schema = z.object({
  full_name: z.string().min(2, "Le nom est requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().optional(),
  role_key: z.enum(["MANAGER", "AGENT", "ACCOUNTANT"]),
  branch_id: z.string().uuid().optional().or(z.literal("")),
});

export type MemberFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: { email: string };
};


export async function addMember(
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const ctx = await requireAgencyPermission("users.create", ["AGENCY_OWNER", "MANAGER"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
    return { error: "Veuillez corriger les champs.", fieldErrors: fe };
  }
  const d = parsed.data;

  const supabase = await createClient();
  if (!(await consumeRateLimit(supabase, "team.invite", 10, 3600))) {
    return { error: "Trop d’invitations. Réessayez dans quelques minutes." };
  }
  const entitlements = await getAgencyEntitlements(supabase, ctx.membership.agencyId);
  if (entitlements.maxUsers !== null && entitlements.currentUsers >= entitlements.maxUsers) {
    return { error: "La limite d'utilisateurs de votre abonnement est atteinte." };
  }

  // Resolve the role id.
  const { data: role } = await supabase.from("roles").select("id").eq("key", d.role_key).maybeSingle();
  if (!role) return { error: "Rôle introuvable." };

  const admin = createAdminClient();

  // Invite the member instead of generating and displaying a reusable password.
  const { data: created, error: createErr } = await admin.auth.admin.inviteUserByEmail(d.email, {
    data: { full_name: d.full_name, phone: d.phone ?? null },
  });
  if (createErr || !created?.user) {
    const msg = createErr?.message?.includes("already been registered")
      ? "Cet email possède déjà un compte."
      : createErr?.message ?? "Impossible de créer le compte.";
    return { error: msg, fieldErrors: { email: msg } };
  }
  const profileId = created.user.id;

  // Ensure profile fields, then attach membership.
  await admin.from("profiles").update({ full_name: d.full_name, phone: d.phone ?? null }).eq("id", profileId);

  const { error: memberErr } = await admin.from("agency_members").insert({
    agency_id: ctx.membership.agencyId,
    profile_id: profileId,
    role_id: role.id,
    branch_id: d.branch_id || ctx.membership.branchId || null,
    status: "active",
    joined_at: new Date().toISOString(),
  });
  if (memberErr) {
    // Roll back the orphaned auth user.
    await admin.auth.admin.deleteUser(profileId);
    return { error: memberErr.message };
  }

  revalidatePath("/agency/team");
  return { success: { email: d.email } };
}

export async function setMemberStatus(memberId: string, status: "active" | "disabled") {
  const ctx = await requireAgencyPermission("users.disable", ["AGENCY_OWNER", "MANAGER"]);
  const supabase = await createClient();

  // Guard: never disable an owner.
  const { data: member } = await supabase
    .from("agency_members")
    .select("id, roles!inner(key)")
    .eq("id", memberId)
    .eq("agency_id", ctx.membership.agencyId)
    .maybeSingle();
  if (!member) return { error: "Membre introuvable." };
  const roleKey = (member.roles as unknown as { key: string }).key;
  if (roleKey === "AGENCY_OWNER") return { error: "Impossible de désactiver le propriétaire." };

  const { error } = await supabase
    .from("agency_members")
    .update({ status })
    .eq("id", memberId)
    .eq("agency_id", ctx.membership.agencyId);
  if (error) return { error: error.message };

  revalidatePath("/agency/team");
  return { ok: true };
}
