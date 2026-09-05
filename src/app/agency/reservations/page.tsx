import Link from "next/link";
import { Plus, CalendarCheck, Clock, Loader, CheckCircle2 } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { listReservations, getReservationStats } from "@/lib/services/reservations";
import { StatCard, PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSearch } from "@/components/ui/table-search";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RESERVATION_STATUS } from "@/lib/labels";

export const metadata = { title: "Réservations — FleetHub" };

export default async function ReservationsPage() {
  const ctx = await requireAgency();
  const [reservations, stats] = await Promise.all([
    listReservations(ctx.membership.agencyId),
    getReservationStats(ctx.membership.agencyId),
  ]);

  return (
    <>
      <PageHeader
        title="Réservations"
        description="Gérez les réservations de vos clients."
        action={
          <Button asChild>
            <Link href="/agency/reservations/new"><Plus /> Nouvelle réservation</Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={CalendarCheck} />
        <StatCard label="Confirmées" value={stats.byStatus.CONFIRMED} icon={Clock} accent="text-primary" />
        <StatCard label="En cours" value={stats.byStatus.ONGOING} icon={Loader} accent="text-green-600" />
        <StatCard label="Terminées" value={stats.byStatus.COMPLETED} icon={CheckCircle2} accent="text-muted-foreground" />
      </div>

      {reservations.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarCheck className="size-6" />
          </div>
          <div>
            <p className="font-medium">Aucune réservation</p>
            <p className="text-sm text-muted-foreground">Créez votre première réservation.</p>
          </div>
          <Button asChild>
            <Link href="/agency/reservations/new"><Plus /> Nouvelle réservation</Link>
          </Button>
        </Card>
      ) : (
        <div data-searchable className="space-y-3">
          <div className="flex justify-end">
            <TableSearch placeholder="Rechercher (réf, client, véhicule)…" />
          </div>
          <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Véhicule</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((r) => (
                  <TableRow key={r.id} data-row>
                    <TableCell>
                      <Link href={`/agency/reservations/${r.id}`} className="font-mono text-sm font-medium hover:underline">
                        {r.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{r.customerName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.vehicleLabel}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(r.start_date)} → {formatDate(r.end_date)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{formatCurrency(Number(r.total_amount))}</TableCell>
                    <TableCell><StatusBadge meta={RESERVATION_STATUS[r.status]} /></TableCell>
                  </TableRow>
                ))}
                <tr data-empty-row hidden>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Aucune réservation ne correspond à votre recherche.
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
