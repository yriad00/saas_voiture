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
  let refunds = 0;
  for (const p of data ?? []) {
    if (p.status !== "COMPLETED") continue;
    if (p.type === "REFUND") refunds += Number(p.amount);
    else income += Number(p.amount);
  }
  return { income, refunds, net: income - refunds, count: data?.length ?? 0 };
}
