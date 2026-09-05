import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { VehicleForm } from "../vehicle-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Ajouter un véhicule — FleetHub" };

export default async function NewVehiclePage() {
  await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/agency/fleet">
          <ArrowLeft /> Retour à la flotte
        </Link>
      </Button>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Ajouter un véhicule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Renseignez les informations ci-dessous pour ajouter un véhicule à votre flotte.
        </p>
      </div>
      <VehicleForm />
    </div>
  );
}
