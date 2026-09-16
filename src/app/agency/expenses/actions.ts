"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgencyPermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/services/audit";
import { createClient } from "@/lib/supabase/server";
import { roundMoney } from "@/lib/utils";

const schema = z.object({
  branch_id: z.string().uuid().optional().or(z.literal("")),
  category: z.enum(["FUEL", "INSURANCE", "TAX", "RENT", "SALARY", "MARKETING", "SUPPLIES", "OTHER"]),
  amount: z.coerce.number().positive(),
  expense_date: z.string().min(1),
  payment_method: z.enum(["CASH", "CARD", "TRANSFER", "CHECK"]),
  vehicle_id: z.string().uuid().optional().or(z.literal("")),
  vendor: z.string().trim().max(160).optional(),
  description: z.string().trim().max(1000).optional(),
  idempotency_key: z.string().max(120).optional().or(z.literal("")),
});

export type ExpenseFormState = { error?: string; fieldErrors?: Record<string, string>; success?: boolean };

export async function createExpense(_prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const ctx = await requireAgencyPermission("expenses.create", ["AGENCY_OWNER", "MANAGER", "ACCOUNTANT"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Veuillez corriger les champs.", fieldErrors };
  }
  const supabase = await createClient();
  const vehicleId = parsed.data.vehicle_id || null;
  let branchId = parsed.data.branch_id || ctx.membership.branchId || null;
  if (vehicleId) {
    const { data: vehicle } = await supabase.from("vehicles").select("id, branch_id").eq("id", vehicleId).eq("agency_id", ctx.membership.agencyId).is("deleted_at", null).maybeSingle();
    if (!vehicle) return { error: "Véhicule introuvable dans cette agence." };
    branchId = vehicle.branch_id ?? branchId;
  }
  const { data: expenseId, error } = await (supabase as any).rpc("record_expense_with_cash", {
    p_agency_id: ctx.membership.agencyId,
    p_branch_id: branchId,
    p_vehicle_id: vehicleId,
    p_category: parsed.data.category,
    p_amount: roundMoney(parsed.data.amount),
    p_expense_date: parsed.data.expense_date,
    p_payment_method: parsed.data.payment_method,
    p_vendor: parsed.data.vendor || null,
    p_description: parsed.data.description || null,
    p_idempotency_key: parsed.data.idempotency_key || null,
  });
  if (error || !expenseId) return { error: error?.message ?? "Impossible d'enregistrer la dépense." };
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, action: "EXPENSE_RECORDED", entityType: "expense", entityId: expenseId, metadata: { category: parsed.data.category, amount: roundMoney(parsed.data.amount), vehicleId } });
  revalidatePath("/agency/expenses");
  revalidatePath("/agency/profitability");
  revalidatePath("/agency/caisse");
  return { success: true };
}
