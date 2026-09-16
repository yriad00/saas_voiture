"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/services/audit";

const riskSchema = z.object({
  reason: z.enum(["UNPAID_DEBT", "FRAUD", "SERIOUS_DAMAGE", "REPEATED_FINES", "LATE_RETURNS", "DOCUMENT_FRAUD", "OTHER"]),
  notes: z.string().trim().max(2000).optional(),
});

export type RiskActionState = { error?: string; success?: boolean };

export async function addCustomerRiskFlag(
  customerId: string,
  _prev: RiskActionState,
  formData: FormData,
): Promise<RiskActionState> {
  const ctx = await requireAgencyPermission("customers.blacklist.manage", ["AGENCY_OWNER", "MANAGER"]);
  if (!z.string().uuid().safeParse(customerId).success) return { error: "Client invalide." };
  const parsed = riskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Sélectionnez un motif de risque." };

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("agency_id", ctx.membership.agencyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!customer) return { error: "Client introuvable dans cette agence." };

  const { data: flag, error } = await supabase
    .from("customer_risk_flags")
    .insert({
      agency_id: ctx.membership.agencyId,
      customer_id: customerId,
      reason: parsed.data.reason,
      notes: parsed.data.notes || null,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return { error: "Un signalement ouvert existe déjà pour ce client." };
  if (error || !flag) return { error: error?.message ?? "Impossible d'enregistrer le signalement." };

  await logAudit(supabase, {
    agencyId: ctx.membership.agencyId,
    actorId: ctx.user.id,
    action: "CUSTOMER_RISK_FLAGGED",
    entityType: "customer",
    entityId: customerId,
    metadata: { flagId: flag.id, reason: parsed.data.reason },
  });

  revalidatePath(`/agency/customers/${customerId}`);
  revalidatePath("/agency/reservations/new");
  return { success: true };
}

export async function resolveCustomerRiskFlag(flagId: string, customerId: string) {
  const ctx = await requireAgencyPermission("customers.blacklist.manage", ["AGENCY_OWNER", "MANAGER"]);
  const supabase = await createClient();
  const { data: flag } = await supabase
    .from("customer_risk_flags")
    .select("id, customer_id")
    .eq("id", flagId)
    .eq("agency_id", ctx.membership.agencyId)
    .eq("customer_id", customerId)
    .eq("status", "OPEN")
    .maybeSingle();
  if (!flag) return { error: "Signalement introuvable." };

  const { error } = await supabase
    .from("customer_risk_flags")
    .update({ status: "RESOLVED", resolved_at: new Date().toISOString(), resolved_by: ctx.user.id })
    .eq("id", flagId)
    .eq("agency_id", ctx.membership.agencyId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    agencyId: ctx.membership.agencyId,
    actorId: ctx.user.id,
    action: "CUSTOMER_RISK_RESOLVED",
    entityType: "customer",
    entityId: customerId,
    metadata: { flagId },
  });
  revalidatePath(`/agency/customers/${customerId}`);
  revalidatePath("/agency/reservations/new");
  return { ok: true };
}
