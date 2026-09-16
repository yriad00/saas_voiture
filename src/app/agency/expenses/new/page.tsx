import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/stat-card";
import { ExpenseForm } from "../expense-form";

export const metadata = { title: "Nouvelle dépense — FleetHub" };

export default async function NewExpensePage() {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "ACCOUNTANT"]);
  const supabase = await createClient();
  const { data: vehicles } = await supabase.from("vehicles").select("id, brand, model, license_plate").eq("agency_id", ctx.membership.agencyId).is("deleted_at", null).order("brand");
  return <><PageHeader title="Nouvelle dépense" description="Enregistrez un coût d'agence ou de véhicule." /><ExpenseForm vehicles={vehicles ?? []} /></>;
}
