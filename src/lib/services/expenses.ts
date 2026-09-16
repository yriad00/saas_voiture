import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type ExpenseListItem = Tables<"expenses"> & { vehicleLabel: string | null };

export async function listExpenses(agencyId: string): Promise<ExpenseListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("*, vehicles(brand, model, license_plate)")
    .eq("agency_id", agencyId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    if (error.code === "PGRST205") return [];
    throw error;
  }
  return (data ?? []).map((expense) => {
    const vehicle = expense.vehicles as unknown as { brand: string; model: string; license_plate: string } | null;
    return {
      ...(expense as Tables<"expenses">),
      vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.license_plate})` : null,
    };
  });
}

export async function getExpenseTotals(agencyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("expenses").select("amount, category").eq("agency_id", agencyId);
  if (error) return { total: 0, byCategory: {}, count: 0, unavailable: error.code === "PGRST205" };
  const total = (data ?? []).reduce((sum, expense) => sum + Number(expense.amount), 0);
  const byCategory = (data ?? []).reduce<Record<string, number>>((result, expense) => {
    result[expense.category] = (result[expense.category] ?? 0) + Number(expense.amount);
    return result;
  }, {});
  return { total, byCategory, count: data?.length ?? 0, unavailable: false };
}
