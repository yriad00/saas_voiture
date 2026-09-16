"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/services/audit";

export async function saveOwnerSettlement(_prev: { error?: string; success?: boolean }, formData: FormData) {
  const ctx = await requireAgencyPermission("payments.create", ["AGENCY_OWNER", "MANAGER", "ACCOUNTANT"]);
  const parsed = z.object({ contract_id: z.string().uuid(), owner_amount: z.coerce.number().min(0), paid_amount: z.coerce.number().min(0), payment_method: z.enum(["CASH", "CARD", "TRANSFER", "CHECK"]).default("CASH"), notes: z.string().max(1000).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Montants invalides." };
  const d = parsed.data;
  const supabase = await createClient();
  const { data: result, error } = await (supabase as any).rpc("save_vehicle_owner_settlement", {
    p_agency_id: ctx.membership.agencyId,
    p_contract_id: d.contract_id,
    p_owner_amount: d.owner_amount,
    p_paid_amount: d.paid_amount,
    p_payment_method: d.payment_method,
    p_notes: d.notes || null,
  });
  if (error || !result) {
    const message = /owner_settlement_overpaid/i.test(error?.message ?? "")
      ? "Le règlement dépasse le montant dû au propriétaire."
      : /owner_settlement_paid_amount_decrease/i.test(error?.message ?? "")
        ? "Le montant déjà réglé ne peut pas être diminué. Utilisez une correction auditable."
        : /cash_session_required/i.test(error?.message ?? "")
          ? "Ouvrez d'abord la caisse de cette agence pour un règlement en espèces."
          : "Impossible d'enregistrer le règlement propriétaire. Réessayez.";
    return { error: message };
  }
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, action: "OWNER_SETTLEMENT_UPDATED", entityType: "vehicle_owner_settlement", entityId: result.id, metadata: { ownerAmount: d.owner_amount, paidAmount: d.paid_amount, paidDelta: result.paid_delta, paymentMethod: d.payment_method, status: result.status, expenseId: result.expense_id } });
  revalidatePath(`/agency/contracts/${d.contract_id}`);
  return { success: true };
}
