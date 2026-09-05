import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { getVehicle } from "@/lib/services/vehicles";
import { VehicleForm } from "../../vehicle-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Modifier le véhicule — FleetHub" };

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const { id } = await params;
  const vehicle = await getVehicle(id);
  if (!vehicle || vehicle.agency_id !== ctx.membership.agencyId) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href={`/agency/fleet/${vehicle.id}`}>
          <ArrowLeft /> Retour au véhicule
        </Link>
      </Button>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Modifier {vehicle.brand} {vehicle.model}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{vehicle.license_plate}</p>
      </div>
      <VehicleForm vehicle={vehicle} />
    </div>
  );
}
