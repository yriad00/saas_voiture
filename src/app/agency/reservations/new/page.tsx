import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listCustomerOptions } from "@/lib/services/customers";
import { ReservationForm } from "../reservation-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Nouvelle réservation — FleetHub" };

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const { customer } = await searchParams;

  const supabase = await createClient();
  const [customers, { data: vehicles }] = await Promise.all([
    listCustomerOptions(ctx.membership.agencyId),
    supabase
      .from("vehicles")
      .select("id, brand, model, license_plate, daily_rate")
      .eq("agency_id", ctx.membership.agencyId)
      .is("deleted_at", null)
      .neq("status", "OUT_OF_SERVICE")
      .order("brand"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/agency/reservations"><ArrowLeft /> Retour aux réservations</Link>
      </Button>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Nouvelle réservation</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sélectionnez un client, un véhicule et une période.</p>
      </div>
      <ReservationForm
        customers={customers}
        vehicles={(vehicles ?? []).map((v) => ({ ...v, daily_rate: Number(v.daily_rate) }))}
        defaultCustomerId={customer}
      />
    </div>
  );
}
