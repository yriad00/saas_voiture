import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Fuel, Gauge, Calendar, Shield, FileText } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { getVehicle } from "@/lib/services/vehicles";
import { VehicleStatusActions } from "./status-actions";
import { DeleteVehicleButton } from "./delete-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { VEHICLE_STATUS, FUEL_TYPE, TRANSMISSION, VEHICLE_CATEGORY } from "@/lib/labels";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAgency();
  const { id } = await params;
  const vehicle = await getVehicle(id);
  if (!vehicle || vehicle.agency_id !== ctx.membership.agencyId) notFound();

  const canWrite = ["AGENCY_OWNER", "MANAGER", "AGENT"].includes(ctx.membership.roleKey);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/agency/fleet">
          <ArrowLeft /> Retour à la flotte
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {vehicle.brand} {vehicle.model}
            </h1>
            <StatusBadge meta={VEHICLE_STATUS[vehicle.status]} />
          </div>
          <p className="text-sm text-muted-foreground">
            {vehicle.year} &middot; {vehicle.license_plate}
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/agency/fleet/${vehicle.id}/edit`}>
                <Pencil /> Modifier
              </Link>
            </Button>
            <VehicleStatusActions vehicleId={vehicle.id} current={vehicle.status} />
            <DeleteVehicleButton vehicleId={vehicle.id} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détails</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Info label="Marque" value={vehicle.brand} />
            <Info label="Modèle" value={vehicle.model} />
            <Info label="Année" value={String(vehicle.year)} />
            <Info label="Couleur" value={vehicle.color} />
            <Info label="Immatriculation" value={vehicle.license_plate} />
            <Info label="N° châssis (VIN)" value={vehicle.vin} />
            <Info label="Catégorie" value={VEHICLE_CATEGORY[vehicle.category] ?? vehicle.category} />
            <Info label="Boîte" value={TRANSMISSION[vehicle.transmission]} />
            <Info icon={Fuel} label="Carburant" value={FUEL_TYPE[vehicle.fuel_type]} />
            <Info label="Places" value={String(vehicle.seats)} />
            <Info label="Portes" value={String(vehicle.doors)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exploitation</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Info icon={Gauge} label="Tarif journalier" value={formatCurrency(Number(vehicle.daily_rate))} />
            <Info label="Kilométrage" value={`${Number(vehicle.mileage).toLocaleString("fr-MA")} km`} />
            <Info icon={Shield} label="Expiration assurance" value={formatDate(vehicle.insurance_expiry)} />
            <Info icon={FileText} label="Visite technique" value={formatDate(vehicle.technical_inspection_expiry)} />
            <Info icon={Calendar} label="Immatriculé le" value={formatDate(vehicle.registration_date)} />
            <Info label="Ajouté le" value={formatDate(vehicle.created_at)} />
          </CardContent>
        </Card>
      </div>

      {vehicle.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{vehicle.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Fuel;
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" />} {label}
      </p>
      <p className="mt-0.5 text-sm">{value ?? "—"}</p>
    </div>
  );
}
