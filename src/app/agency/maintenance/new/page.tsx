import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { MaintenanceForm } from "../maintenance-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Nouvelle intervention — FleetHub" };

export default async function NewMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string }>;
}) {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const { vehicle } = await searchParams;

  const supabase = await createClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, brand, model, license_plate")
    .eq("agency_id", ctx.membership.agencyId)
    .is("deleted_at", null)
    .order("brand");

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/agency/maintenance"><ArrowLeft /> Retour à la maintenance</Link>
      </Button>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Nouvelle intervention</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enregistrez un entretien ou une réparation.</p>
      </div>
      <MaintenanceForm vehicles={vehicles ?? []} defaultVehicleId={vehicle} />
    </div>
  );
}
