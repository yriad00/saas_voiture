import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listCustomerOptions } from "@/lib/services/customers";
import { getReservation } from "@/lib/services/reservations";
import { ContractForm, type ContractPrefill } from "../contract-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Nouveau contrat — FleetHub" };

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ reservation?: string }>;
}) {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const { reservation } = await searchParams;

  const supabase = await createClient();
  const [customers, { data: vehicles }] = await Promise.all([
    listCustomerOptions(ctx.membership.agencyId),
    supabase
      .from("vehicles")
      .select("id, brand, model, license_plate")
      .eq("agency_id", ctx.membership.agencyId)
      .is("deleted_at", null)
      .order("brand"),
  ]);

  let prefill: ContractPrefill | undefined;
  if (reservation) {
    const r = await getReservation(reservation);
    if (r && r.agency_id === ctx.membership.agencyId) {
      prefill = {
        reservation_id: r.id,
        customer_id: r.customer.id,
        vehicle_id: r.vehicle.id,
        start_date: r.start_date,
        end_date: r.end_date,
        daily_rate: Number(r.daily_rate),
        total_amount: Number(r.total_amount),
      };
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/agency/contracts"><ArrowLeft /> Retour aux contrats</Link>
      </Button>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Nouveau contrat</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {prefill ? "Pré-rempli depuis la réservation." : "Renseignez les informations du contrat de location."}
        </p>
      </div>
      <ContractForm customers={customers} vehicles={vehicles ?? []} prefill={prefill} />
    </div>
  );
}
