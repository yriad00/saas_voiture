import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type PaymentListItem = Tables<"payments"> & {
  customerName: string | null;
  contractNumber: string | null;
};

export async function listPayments(agencyId: string): Promise<PaymentListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*, customers(first_name, last_name), contracts(contract_number)")
    .eq("agency_id", agencyId)
    .order("paid_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((p) => {
    const c = p.customers as unknown as { first_name: string; last_name: string } | null;
    const ct = p.contracts as unknown as { contract_number: string } | null;
    return {
      ...(p as Tables<"payments">),
      customerName: c ? `${c.first_name} ${c.last_name}` : null,
      contractNumber: ct?.contract_number ?? null,
    };
  });
}

export async function getPaymentTotals(agencyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("amount, type, status")
    .eq("agency_id", agencyId);

  let income = 0;
  let deposits = 0;
  let depositRefunds = 0;
  let refunds = 0;
  for (const p of data ?? []) {
    if (p.status !== "COMPLETED") continue;
    if (p.type === "REFUND") refunds += Number(p.amount);
    else if (p.type === "DEPOSIT_REFUND") depositRefunds += Number(p.amount);
    else if (p.type === "DEPOSIT") deposits += Number(p.amount);
    else income += Number(p.amount);
  }
  return { income, deposits, depositRefunds, refunds, net: income - refunds, collected: income + deposits - depositRefunds - refunds, count: data?.length ?? 0 };
}

export type ProfitabilityMonth = {
  key: string;
  label: string;
  income: number;
  maintenanceCost: number;
  expenseCost: number;
  totalCost: number;
  net: number;
};

export async function getProfitabilitySummary(agencyId: string) {
  const supabase = await createClient();
  const [{ data: payments }, { data: maintenance }, { data: expenses, error: expensesError }] = await Promise.all([
    supabase.from("payments").select("amount, type, status, paid_at").eq("agency_id", agencyId),
    supabase.from("maintenance_records").select("cost, status, service_date").eq("agency_id", agencyId),
    supabase.from("expenses").select("amount, expense_date").eq("agency_id", agencyId),
  ]);

  const incomeByMonth = new Map<string, number>();
  const costByMonth = new Map<string, number>();
  const expenseByMonth = new Map<string, number>();
  for (const payment of payments ?? []) {
    if (payment.status !== "COMPLETED" || ["DEPOSIT", "DEPOSIT_REFUND"].includes(payment.type)) continue;
    const key = payment.paid_at.slice(0, 7);
    const amount = Number(payment.amount) * (payment.type === "REFUND" ? -1 : 1);
    incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + amount);
  }
  for (const item of maintenance ?? []) {
    if (item.status !== "COMPLETED") continue;
    const key = item.service_date.slice(0, 7);
    costByMonth.set(key, (costByMonth.get(key) ?? 0) + Number(item.cost));
  }
  for (const expense of expenses ?? []) {
    const key = expense.expense_date.slice(0, 7);
    expenseByMonth.set(key, (expenseByMonth.get(key) ?? 0) + Number(expense.amount));
  }

  const now = new Date();
  const months: ProfitabilityMonth[] = [];
  for (let offset = 11; offset >= 0; offset--) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = date.toISOString().slice(0, 7);
    const income = incomeByMonth.get(key) ?? 0;
    const maintenanceCost = costByMonth.get(key) ?? 0;
    const expenseCost = expenseByMonth.get(key) ?? 0;
    months.push({
      key,
      label: new Intl.DateTimeFormat("fr-MA", { month: "short", year: "numeric" }).format(date),
      income,
      maintenanceCost,
      expenseCost,
      totalCost: maintenanceCost + expenseCost,
      net: income - maintenanceCost - expenseCost,
    });
  }
  const income = months.reduce((sum, month) => sum + month.income, 0);
  const maintenanceCost = months.reduce((sum, month) => sum + month.maintenanceCost, 0);
  const expenseCost = months.reduce((sum, month) => sum + month.expenseCost, 0);
  return { income, maintenanceCost, expenseCost, totalCost: maintenanceCost + expenseCost, net: income - maintenanceCost - expenseCost, months, expensesUnavailable: expensesError?.code === "PGRST205" };
}
