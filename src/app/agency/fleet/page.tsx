import Link from "next/link";
import { Plus, CarFront, Gauge, Wrench, Ban } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { listVehicles, getFleetStats } from "@/lib/services/vehicles";
import { StatCard, PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { TableSearch } from "@/components/ui/table-search";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { VEHICLE_STATUS, VEHICLE_CATEGORY } from "@/lib/labels";

export const metadata = { title: "Flotte — FleetHub" };

export default async function FleetPage() {
  const ctx = await requireAgency();
  const [vehicles, stats] = await Promise.all([
    listVehicles(ctx.membership.agencyId),
    getFleetStats(ctx.membership.agencyId),
  ]);

  return (
    <>
      <PageHeader
        title="Flotte"
        description="Gérez vos véhicules — ajout, modification et suivi du statut."
        action={
          <Button asChild>
            <Link href="/agency/fleet/new">
              <Plus /> Ajouter un véhicule
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total" value={stats.total} icon={CarFront} />
        <StatCard label="Disponibles" value={stats.byStatus.AVAILABLE} icon={CarFront} accent="text-green-600" />
        <StatCard label="Loués" value={stats.byStatus.RENTED} icon={Gauge} accent="text-primary" />
        <StatCard label="En maintenance" value={stats.byStatus.MAINTENANCE} icon={Wrench} accent="text-amber-600" />
        <StatCard label="Hors service" value={stats.byStatus.OUT_OF_SERVICE} icon={Ban} accent="text-red-600" />
      </div>

      {vehicles.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CarFront className="size-6" />
          </div>
          <div>
            <p className="font-medium">Aucun véhicule</p>
            <p className="text-sm text-muted-foreground">
              Ajoutez votre premier véhicule pour commencer à gérer votre flotte.
            </p>
          </div>
          <Button asChild>
            <Link href="/agency/fleet/new">
              <Plus /> Ajouter un véhicule
            </Link>
          </Button>
        </Card>
      ) : (
        <div data-searchable className="space-y-3">
          <div className="flex justify-end">
            <TableSearch placeholder="Rechercher un véhicule…" />
          </div>
          <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Véhicule</TableHead>
                  <TableHead>Immatriculation</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Tarif / jour</TableHead>
                  <TableHead>Kilométrage</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((v) => (
                  <TableRow key={v.id} data-row>
                    <TableCell>
                      <Link
                        href={`/agency/fleet/${v.id}`}
                        className="font-medium hover:underline"
                      >
                        {v.brand} {v.model}
                        <span className="ml-2 text-xs text-muted-foreground">{v.year}</span>
                      </Link>
                      {v.color && (
                        <span className="block text-xs text-muted-foreground">{v.color}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{v.license_plate}</TableCell>
                    <TableCell className="text-sm">
                      {VEHICLE_CATEGORY[v.category] ?? v.category}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {formatCurrency(Number(v.daily_rate))}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {Number(v.mileage).toLocaleString("fr-MA")} km
                    </TableCell>
                    <TableCell>
                      <StatusBadge meta={VEHICLE_STATUS[v.status]} />
                    </TableCell>
                  </TableRow>
                ))}
                <tr data-empty-row hidden>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Aucun véhicule ne correspond à votre recherche.
                  </TableCell>
                </tr>
              </TableBody>
            </Table>
          </div>
          </Card>
        </div>
      )}
    </>
  );
}
