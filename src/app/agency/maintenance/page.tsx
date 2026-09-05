import Link from "next/link";
import { Plus, Wrench, CalendarClock, Coins } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { listMaintenance, getMaintenanceTotals } from "@/lib/services/maintenance";
import { StatCard, PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSearch } from "@/components/ui/table-search";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MAINTENANCE_TYPE, MAINTENANCE_STATUS } from "@/lib/labels";

export const metadata = { title: "Maintenance — FleetHub" };

export default async function MaintenancePage() {
  const ctx = await requireAgency();
  const [records, totals] = await Promise.all([
    listMaintenance(ctx.membership.agencyId),
    getMaintenanceTotals(ctx.membership.agencyId),
  ]);

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Suivi de l'entretien et des réparations de votre flotte."
        action={
          <Button asChild>
            <Link href="/agency/maintenance/new"><Plus /> Nouvelle intervention</Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Interventions" value={totals.count} icon={Wrench} />
        <StatCard label="Planifiées" value={totals.scheduled} icon={CalendarClock} accent="text-amber-600" />
        <StatCard label="Coût total" value={formatCurrency(totals.totalCost)} icon={Coins} accent="text-primary" />
      </div>

      {records.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Wrench className="size-6" />
          </div>
          <div>
            <p className="font-medium">Aucune intervention</p>
            <p className="text-sm text-muted-foreground">Enregistrez la première intervention d'entretien.</p>
          </div>
          <Button asChild>
            <Link href="/agency/maintenance/new"><Plus /> Nouvelle intervention</Link>
          </Button>
        </Card>
      ) : (
        <div data-searchable className="space-y-3">
          <div className="flex justify-end">
            <TableSearch placeholder="Rechercher une intervention…" />
          </div>
          <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Véhicule</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Garage</TableHead>
                  <TableHead>Coût</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((m) => (
                  <TableRow key={m.id} data-row>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(m.service_date)}</TableCell>
                    <TableCell className="text-sm">{m.vehicleLabel}</TableCell>
                    <TableCell className="text-sm">{MAINTENANCE_TYPE[m.type]}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.garage_name ?? "—"}</TableCell>
                    <TableCell className="text-sm tabular-nums">{formatCurrency(Number(m.cost))}</TableCell>
                    <TableCell><StatusBadge meta={MAINTENANCE_STATUS[m.status]} /></TableCell>
                  </TableRow>
                ))}
                <tr data-empty-row hidden>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Aucune intervention ne correspond à votre recherche.
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
