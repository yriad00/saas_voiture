import Link from "next/link";
import { Plus, CarFront, Satellite } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { listVehicles, computeFleetStats } from "@/lib/services/vehicles";
import { PageHeader } from "@/components/layout/stat-card";
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
import { ImportPanel } from "../import/import-panel";
import { ExportButtons } from "../export-buttons";

export const metadata = { title: "Flotte — FleetHub" };

export default async function FleetPage() {
  const ctx = await requireAgency();
  const vehicles = await listVehicles(ctx.membership.agencyId);
  const stats = computeFleetStats(vehicles);

  return (
    <>
      <PageHeader
        title="Flotte"
        description="Gérez vos véhicules — ajout, modification et suivi du statut."
        action={
          <>
            <ExportButtons
              filename="flotte-fleethub"
              columns={[
                { key: "brand", label: "Marque" },
                { key: "model", label: "Modèle" },
                { key: "year", label: "Année" },
                { key: "license_plate", label: "Immatriculation" },
                { key: "category", label: "Catégorie" },
                { key: "fuel_type", label: "Carburant" },
                { key: "transmission", label: "Boîte" },
                { key: "daily_rate", label: "Tarif journalier" },
                { key: "mileage", label: "Kilométrage" },
                { key: "status", label: "Statut" },
                { key: "gps_provider", label: "Fournisseur GPS" },
                { key: "gps_device_id", label: "ID boîtier GPS" },
              ]}
              rows={vehicles as unknown as Array<Record<string, unknown>>}
            />
            <Button asChild>
              <Link href="/agency/fleet/new">
                <Plus /> Ajouter un véhicule
              </Link>
            </Button>
          </>
        }
      />

      <ImportPanel kind="vehicles" />

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border/70 py-3 text-sm">
        <span><strong>{stats.total}</strong> véhicules</span>
        <span className="text-emerald-600 dark:text-emerald-400"><strong>{stats.byStatus.AVAILABLE}</strong> disponibles</span>
        <span className="text-primary"><strong>{stats.byStatus.RENTED}</strong> loués</span>
        <span className="text-amber-600 dark:text-amber-400"><strong>{stats.byStatus.MAINTENANCE}</strong> maintenance</span>
        <span className="text-muted-foreground"><strong>{stats.byStatus.OUT_OF_SERVICE}</strong> hors service</span>
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
                  <TableHead>GPS</TableHead>
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
                    <TableCell>
                      {v.gps_enabled ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"><Satellite className="size-3.5" /> Activé</span>
                      ) : <span className="text-xs text-muted-foreground">Non configuré</span>}
                    </TableCell>
                  </TableRow>
                ))}
                <tr data-empty-row hidden>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
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
