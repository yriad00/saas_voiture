import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables, Enums } from "@/lib/database.types";

export type ContractRow = Tables<"contracts">;

export type ContractListItem = ContractRow & {
  customerName: string;
  vehicleLabel: string;
};

export async function listContracts(agencyId: string): Promise<ContractListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("*, customers!inner(first_name, last_name), vehicles!inner(brand, model, license_plate)")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((c) => {
    const cust = c.customers as unknown as { first_name: string; last_name: string };
    const v = c.vehicles as unknown as { brand: string; model: string; license_plate: string };
    return {
      ...(c as ContractRow),
      customerName: `${cust.first_name} ${cust.last_name}`,
      vehicleLabel: `${v.brand} ${v.model} (${v.license_plate})`,
    };
  });
}

export type ContractDetail = ContractRow & {
  customer: { id: string; name: string; phone: string | null; email: string | null };
  vehicle: { id: string; label: string; plate: string };
  reservationRef: string | null;
  payments: Array<Tables<"payments">>;
  paidTotal: number;
};

export async function getContract(id: string): Promise<ContractDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contracts")
    .select("*, customers!inner(id, first_name, last_name, phone, email), vehicles!inner(id, brand, model, license_plate), reservations(reference)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const c = data.customers as unknown as { id: string; first_name: string; last_name: string; phone: string | null; email: string | null };
  const v = data.vehicles as unknown as { id: string; brand: string; model: string; license_plate: string };
  const resv = data.reservations as unknown as { reference: string } | null;

  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("contract_id", id)
    .order("paid_at", { ascending: false });

  const paidTotal = (payments ?? [])
    .filter((p) => p.status === "COMPLETED" && p.type !== "REFUND")
    .reduce((s, p) => s + Number(p.amount), 0);

  return {
    ...(data as ContractRow),
    customer: { id: c.id, name: `${c.first_name} ${c.last_name}`, phone: c.phone, email: c.email },
    vehicle: { id: v.id, label: `${v.brand} ${v.model}`, plate: v.license_plate },
    reservationRef: resv?.reference ?? null,
    payments: payments ?? [],
    paidTotal,
  };
}

export type ContractStats = {
  total: number;
  byStatus: Record<Enums<"contract_status">, number>;
};

export async function getContractStats(agencyId: string): Promise<ContractStats> {
  const supabase = await createClient();
  const { data } = await supabase.from("contracts").select("status").eq("agency_id", agencyId);
  const byStatus: Record<Enums<"contract_status">, number> = { DRAFT: 0, ACTIVE: 0, CLOSED: 0, CANCELLED: 0 };
  for (const c of data ?? []) byStatus[c.status]++;
  return { total: data?.length ?? 0, byStatus };
}

export async function nextContractNumber(agencyId: string): Promise<string> {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("contracts")
    .select("*", { count: "exact", head: true })
    .eq("agency_id", agencyId);
  return `CTR-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}
