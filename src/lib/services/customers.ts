import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type CustomerRow = Tables<"customers">;

export async function listCustomers(agencyId: string): Promise<CustomerRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("agency_id", agencyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getCustomer(id: string): Promise<CustomerRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

/** Lightweight list for select dropdowns (reservations, contracts). */
export async function listCustomerOptions(agencyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, first_name, last_name, phone")
    .eq("agency_id", agencyId)
    .is("deleted_at", null)
    .order("first_name");
  return data ?? [];
}
