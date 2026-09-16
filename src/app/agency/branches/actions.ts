"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";
import { getAgencyEntitlements } from "@/lib/services/entitlements";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import { logAudit } from "@/lib/services/audit";

const branchSchema = z.object({
  name: z.string().trim().min(2, "Le nom de l'agence est requis").max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{1,15}$/, "Code invalide (2 à 16 caractères)").transform((value) => value.toUpperCase()),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  address: z.string().trim().max(240).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
});

export type BranchFormState = { error?: string; fieldErrors?: Record<string, string>; success?: boolean };

export async function createBranch(_prev: BranchFormState, formData: FormData): Promise<BranchFormState> {
  const ctx = await requireAgencyPermission("branches.create", ["AGENCY_OWNER", "MANAGER"]);
  const parsed = branchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Veuillez corriger les champs.", fieldErrors };
  }
  const supabase = await createClient();
  if (!(await consumeRateLimit(supabase, "branches.create", 20, 3600))) return { error: "Trop de créations de branches. Réessayez plus tard." };
  const entitlements = await getAgencyEntitlements(supabase, ctx.membership.agencyId);
  if (entitlements.maxBranches !== null && entitlements.currentBranches >= entitlements.maxBranches) {
    return { error: "La limite de branches de votre abonnement est atteinte." };
  }
  const d = parsed.data;
  const { data: branch, error } = await supabase.from("branches").insert({
    agency_id: ctx.membership.agencyId,
    name: d.name,
    code: d.code,
    city: d.city || null,
    address: d.address || null,
    phone: d.phone || null,
    whatsapp: d.whatsapp || null,
    email: d.email || null,
  }).select("id").single();
  if (error || !branch) {
    if (error?.code === "23505") return { error: "Ce code de branche existe déjà.", fieldErrors: { code: "Code déjà utilisé" } };
    return { error: error?.message ?? "Impossible de créer la branche." };
  }
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, action: "BRANCH_CREATED", entityType: "branch", entityId: branch.id, metadata: { code: d.code } });
  revalidatePath("/agency/branches");
  return { success: true };
}

export async function setBranchStatus(branchId: string, active: boolean) {
  const ctx = await requireAgencyPermission("branches.update", ["AGENCY_OWNER", "MANAGER"]);
  const supabase = await createClient();
  const { data: branch, error } = await supabase.from("branches").update({ active }).eq("id", branchId).eq("agency_id", ctx.membership.agencyId).select("id").maybeSingle();
  if (error || !branch) return { error: error?.message ?? "Branche introuvable." };
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, action: active ? "BRANCH_ACTIVATED" : "BRANCH_DEACTIVATED", entityType: "branch", entityId: branchId, metadata: {} });
  revalidatePath("/agency/branches");
  return { ok: true };
}
