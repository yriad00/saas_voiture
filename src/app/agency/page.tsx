import Link from "next/link";
import { CarFront, Contact, CalendarCheck, FileText, Wallet, TrendingUp, Plus, ArrowRight } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getFleetStats } from "@/lib/services/vehicles";
import { getReservationStats } from "@/lib/services/reservations";
import { getPaymentTotals } from "@/lib/services/payments";
import { StatCard, PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, AgencyStatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RESERVATION_STATUS } from "@/lib/labels";

export const metadata = { title: "Tableau de bord — FleetHub" };

export default async function AgencyDashboard() {
  const ctx = await requireAgency();
  const agencyId = ctx.membership.agencyId;
  const supabase = await createClient();

  const [fleet, resStats, payTotals, { count: customerCount }, { data: recent }] = await Promise.all([
    getFleetStats(agencyId),
    getReservationStats(agencyId),
    getPaymentTotals(agencyId),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("agency_id", agencyId).is("deleted_at", null),
    supabase
      .from("reservations")
      .select("id, reference, start_date, end_date, total_amount, status, customers!inner(first_name, last_name), vehicles!inner(brand, model)")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const activeReservations = resStats.byStatus.CONFIRMED + resStats.byStatus.ONGOING;

  return (
    <>
      <PageHeader
        title={`Bonjour, ${ctx.profile.full_name?.split(" ")[0] ?? ""}`}
        description={ctx.membership.agencyName}
        action={
          <div className="flex items-center gap-2">
            <AgencyStatusBadge status={ctx.membership.agencyStatus} />
            <Button asChild size="sm">
              <Link href="/agency/reservations/new"><Plus /> Réservation</Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Véhicules" value={fleet.total} icon={CarFront} />
        <StatCard label="Disponibles" value={fleet.byStatus.AVAILABLE} icon={CarFront} accent="text-green-600" />
        <StatCard label="Clients" value={customerCount ?? 0} icon={Contact} accent="text-primary" />
        <StatCard label="Réserv. actives" value={activeReservations} icon={CalendarCheck} accent="text-primary" />
        <StatCard label="Contrats actifs" value={resStats.byStatus.ONGOING} icon={FileText} accent="text-amber-600" />
        <StatCard label="Encaissé (net)" value={formatCurrency(payTotals.net)} icon={TrendingUp} accent="text-green-600" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Réservations récentes</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/agency/reservations">Tout voir <ArrowRight /></Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {recent && recent.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Véhicule</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((r) => {
                    const c = r.customers as unknown as { first_name: string; last_name: string };
                    const v = r.vehicles as unknown as { brand: string; model: string };
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link href={`/agency/reservations/${r.id}`} className="font-mono text-xs font-medium hover:underline">{r.reference}</Link>
                        </TableCell>
                        <TableCell className="text-sm">{c.first_name} {c.last_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{v.brand} {v.model}</TableCell>
                        <TableCell className="text-sm tabular-nums">{formatCurrency(Number(r.total_amount))}</TableCell>
                        <TableCell><StatusBadge meta={RESERVATION_STATUS[r.status]} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="px-6 py-4 text-sm text-muted-foreground">Aucune réservation pour le moment.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Accès rapides</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-2">
            <QuickLink href="/agency/fleet/new" icon={CarFront} label="Ajouter un véhicule" />
            <QuickLink href="/agency/customers/new" icon={Contact} label="Ajouter un client" />
            <QuickLink href="/agency/reservations/new" icon={CalendarCheck} label="Nouvelle réservation" />
            <QuickLink href="/agency/contracts/new" icon={FileText} label="Nouveau contrat" />
            <QuickLink href="/agency/payments/new" icon={Wallet} label="Enregistrer un paiement" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof CarFront; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted">
      <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      {label}
      <ArrowRight className="ml-auto size-4 text-muted-foreground" />
    </Link>
  );
}
