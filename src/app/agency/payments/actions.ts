"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, requireAgency } from "@/lib/auth/session";
import { roundMoney } from "@/lib/utils";
import { logAudit } from "@/lib/services/audit";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import { startPerf } from "@/lib/perf";

const schema = z.object({
  contract_id: z.string().uuid().optional().or(z.literal("")),
  reservation_id: z.string().uuid().optional().or(z.literal("")),
  customer_id: z.string().uuid().optional().or(z.literal("")),
  amount: z.coerce.number().min(0.01, "Le montant doit être supérieur à 0"),
  method: z.enum(["CASH", "CARD", "TRANSFER", "CHECK"]).default("CASH"),
  type: z.enum(["DEPOSIT", "DEPOSIT_REFUND", "RENTAL", "REFUND", "PENALTY", "EXTRA"]).default("RENTAL"),
  status: z.enum(["PENDING", "COMPLETED", "REFUNDED", "FAILED"]).default("COMPLETED"),
  reference: z.string().optional(),
  paid_at: z.string().optional(),
  notes: z.string().optional(),
  idempotency_key: z.string().max(120).optional().or(z.literal("")),
});

export type PaymentFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  redirectTo?: string;
};

export async function createPayment(
  _prev: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const endPerf = startPerf("createPayment");
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "ACCOUNTANT"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
    return { error: "Veuillez corriger les champs.", fieldErrors: fe };
  }
  const d = parsed.data;
  if (d.contract_id && d.reservation_id) return { error: "Choisissez un contrat ou une réservation, pas les deux." };

  const permission = d.type === "DEPOSIT_REFUND" ? "deposits.refund" : d.type === "REFUND" ? "payments.refund" : "payments.create";
  if (!can(ctx, permission)) return { error: "Vous n'avez pas la permission d'effectuer cette opération." };

  const supabase = await createClient();
  if (!(await consumeRateLimit(supabase, "payments.write", 60, 60))) {
    return { error: "Trop de tentatives financières. Réessayez dans une minute." };
  }

  if (d.idempotency_key) {
    const { data: existing } = await supabase
      .from("payments")
      .select("id,amount,method,type,status,contract_id,reservation_id")
      .eq("agency_id", ctx.membership.agencyId)
      .eq("idempotency_key", d.idempotency_key)
      .maybeSingle();
    if (existing) {
      const payloadMatches = Number(existing.amount) === roundMoney(d.amount)
        && existing.method === d.method
        && existing.type === d.type
        && existing.status === d.status
        && (existing.contract_id ?? null) === (d.contract_id || null)
        && (existing.reservation_id ?? null) === (d.reservation_id || null);
      if (!payloadMatches) {
        endPerf();
        return { error: "Cette clé d'idempotence est déjà utilisée pour une autre opération." };
      }
      endPerf();
      return { success: true, redirectTo: d.contract_id ? `/agency/contracts/${d.contract_id}` : "/agency/payments" };
    }
  }

  // Resolve the customer from the contract and reject cross-tenant or mismatched links.
  let customerId = d.customer_id || null;
  let branchId = ctx.membership.branchId || null;
  if (d.contract_id) {
    const { data: ct } = await supabase
      .from("contracts")
      .select("customer_id, branch_id")
      .eq("id", d.contract_id)
      .eq("agency_id", ctx.membership.agencyId)
      .maybeSingle();
    if (!ct) return { error: "Contrat introuvable dans cette agence." };
    if (customerId && customerId !== ct.customer_id) return { error: "Le client ne correspond pas au contrat." };
    customerId = ct.customer_id;
    branchId = ct.branch_id ?? branchId;
  } else if (d.reservation_id) {
    const { data: reservation } = await (supabase as any)
      .from("reservations")
      .select("customer_id, branch_id, pickup_branch_id")
      .eq("id", d.reservation_id)
      .eq("agency_id", ctx.membership.agencyId)
      .maybeSingle();
    if (!reservation) return { error: "Réservation introuvable dans cette agence." };
    if (customerId && customerId !== reservation.customer_id) return { error: "Le client ne correspond pas à la réservation." };
    customerId = reservation.customer_id;
    branchId = reservation.pickup_branch_id ?? reservation.branch_id ?? branchId;
  } else if (customerId) {
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .eq("agency_id", ctx.membership.agencyId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!customer) return { error: "Client introuvable dans cette agence." };
  }

  if (["REFUND", "DEPOSIT_REFUND"].includes(d.type) && !d.contract_id && !d.reservation_id) {
    return { error: "Un remboursement doit être lié à un contrat ou une réservation." };
  }

  if ((d.contract_id || d.reservation_id) && ["REFUND", "DEPOSIT_REFUND"].includes(d.type)) {
    const parentId = d.contract_id || d.reservation_id;
    if (!parentId) return { error: "Le parent du remboursement est requis." };
    const { data: priorPayments } = await (supabase as any)
      .from("payments")
      .select("amount, type, status")
      .eq(d.contract_id ? "contract_id" : "reservation_id", parentId);
    const completed: Array<{ amount: number | string; type: string; status: string }> = ((priorPayments ?? []) as Array<{ amount: number | string; type: string; status: string }>).filter((payment) => payment.status === "COMPLETED");
    const sourceTypes = d.type === "REFUND" ? ["RENTAL", "PENALTY", "EXTRA"] : ["DEPOSIT"];
    const refundType = d.type === "REFUND" ? "REFUND" : "DEPOSIT_REFUND";
    const available = completed
      .filter((payment) => sourceTypes.includes(payment.type))
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
      - completed
        .filter((payment) => payment.type === refundType)
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
    if (d.amount > available) {
      return { error: "Le remboursement dépasse le montant disponible sur ce contrat." };
    }
  }

  // The database function inserts the payment and (for completed cash
  // operations) its caisse movement in one transaction. Retries with the
  // same idempotency key return the original payment id.
  const rpcArgs = {
    p_agency_id: ctx.membership.agencyId,
    p_branch_id: branchId,
    p_customer_id: customerId,
    p_amount: roundMoney(d.amount),
    p_method: d.method,
    p_type: d.type,
    p_status: d.status,
    p_reference: d.reference || null,
    p_paid_at: d.paid_at ? new Date(d.paid_at).toISOString() : new Date().toISOString(),
    p_notes: d.notes || null,
    p_idempotency_key: d.idempotency_key || null,
  };
  const { data: paymentId, error } = d.reservation_id
    ? await (supabase as any).rpc("record_reservation_payment_with_cash", { ...rpcArgs, p_reservation_id: d.reservation_id })
    : await (supabase as any).rpc("record_payment_with_cash", { ...rpcArgs, p_contract_id: d.contract_id || null });
  if (error || !paymentId) return { error: error?.message ?? "Impossible d'enregistrer le paiement." };

  await logAudit(supabase, {
    agencyId: ctx.membership.agencyId,
    actorId: ctx.user.id,
    action: "PAYMENT_RECORDED",
    entityType: "payment",
    entityId: paymentId,
    metadata: { contractId: d.contract_id || null, type: d.type, amount: roundMoney(d.amount), method: d.method },
  });

  revalidatePath("/agency/payments");
  revalidatePath("/agency/caisse");
  if (d.contract_id) revalidatePath(`/agency/contracts/${d.contract_id}`);
  if (d.reservation_id) revalidatePath(`/agency/reservations/${d.reservation_id}`);
  endPerf();
  return { success: true, redirectTo: d.contract_id ? `/agency/contracts/${d.contract_id}` : d.reservation_id ? `/agency/reservations/${d.reservation_id}` : "/agency/payments" };
}
