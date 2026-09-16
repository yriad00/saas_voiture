import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { VehicleForm } from "../vehicle-form";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Ajouter un véhicule — FleetHub" };

export default async function NewVehiclePage() {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const supabase = await createClient();
  const { data: branches } = await supabase.from("branches").select("id, name, code, city, address, phone, whatsapp, email, opening_hours, active, created_at, updated_at, agency_id").eq("agency_id", ctx.membership.agencyId).eq("active", true).order("name");

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
      <VehicleForm branches={branches ?? []} />
    </div>
  );
}
