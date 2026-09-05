"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgency } from "@/lib/auth/session";

const schema = z.object({
  contract_id: z.string().uuid().optional().or(z.literal("")),
  customer_id: z.string().uuid().optional().or(z.literal("")),
  amount: z.coerce.number().min(0.01, "Le montant doit être supérieur à 0"),
  method: z.enum(["CASH", "CARD", "TRANSFER", "CHECK"]).default("CASH"),
  type: z.enum(["DEPOSIT", "RENTAL", "REFUND", "PENALTY", "EXTRA"]).default("RENTAL"),
  status: z.enum(["PENDING", "COMPLETED", "REFUNDED", "FAILED"]).default("COMPLETED"),
  reference: z.string().optional(),
  paid_at: z.string().optional(),
  notes: z.string().optional(),
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
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "ACCOUNTANT"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
    return { error: "Veuillez corriger les champs.", fieldErrors: fe };
  }
  const d = parsed.data;

  const supabase = await createClient();

  // If a contract is provided but no customer, derive customer from the contract.
  let customerId = d.customer_id || null;
  if (d.contract_id && !customerId) {
    const { data: ct } = await supabase.from("contracts").select("customer_id").eq("id", d.contract_id).maybeSingle();
    customerId = ct?.customer_id ?? null;
  }

  const { error } = await supabase.from("payments").insert({
    agency_id: ctx.membership.agencyId,
    contract_id: d.contract_id || null,
    customer_id: customerId,
    amount: d.amount,
    method: d.method,
    type: d.type,
    status: d.status,
    reference: d.reference || null,
    paid_at: d.paid_at ? new Date(d.paid_at).toISOString() : new Date().toISOString(),
    notes: d.notes || null,
    created_by: ctx.user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/agency/payments");
  if (d.contract_id) revalidatePath(`/agency/contracts/${d.contract_id}`);
  return { success: true, redirectTo: d.contract_id ? `/agency/contracts/${d.contract_id}` : "/agency/payments" };
}
