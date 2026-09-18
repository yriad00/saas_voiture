import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarCheck, Contact, Plus } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, AgencyStatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RESERVATION_STATUS } from "@/lib/labels";
import { getDashboardData } from "@/lib/services/dashboard";

export const metadata = { title: "Tableau de bord — FleetHub" };

export default async function AgencyDashboard() {
  const ctx = await requireAgency();
  if (ctx.membership.roleKey === "AGENT") redirect("/agency/today");

  const supabase = await createClient();
  const [{ data: recent }, dashboardData] = await Promise.all([
    supabase
      .from("reservations")
      .select("id, reference, start_date, end_date, total_amount, status, customers!inner(first_name, last_name), vehicles!inner(brand, model)")
      .eq("agency_id", ctx.membership.agencyId)
      .order("created_at", { ascending: false })
      .limit(5),
    getDashboardData(ctx.membership.agencyId, ctx.membership.branchId),
  ]);
  const metrics = dashboardData.metrics;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={`${ctx.membership.agencyName} · les chiffres qui aident à décider.`}
        action={
          <div className="flex items-center gap-2">
            <AgencyStatusBadge status={ctx.membership.agencyStatus} />
            <Button asChild size="sm"><Link href="/agency/reservations/new"><Plus /> Nouvelle réservation</Link></Button>
          </div>
        }
      />

      <section aria-label="Indicateurs de pilotage" className="mb-8 overflow-hidden rounded-2xl border border-border/70 bg-card/70">
        <div className="grid grid-cols-2 divide-x divide-y divide-border/70 sm:grid-cols-3 sm:divide-y-0">
          <Metric label="CA aujourd’hui" value={formatCurrency(metrics.revenueToday)} />
          <Metric label="CA ce mois" value={formatCurrency(metrics.revenueMonth)} />
          <Metric label="À encaisser" value={formatCurrency(metrics.unpaidBalances)} tone={metrics.unpaidBalances > 0 ? "warning" : undefined} />
          <Metric label="Flotte utilisée" value={`${metrics.utilizationRate}%`} />
          <Metric label="Véhicules indisponibles" value={metrics.unavailableVehicles + metrics.maintenanceVehicles} tone={metrics.unavailableVehicles + metrics.maintenanceVehicles > 0 ? "warning" : undefined} />
          <Metric label="Résultat estimé" value={formatCurrency(metrics.netProfitMonth)} tone={metrics.netProfitMonth < 0 ? "warning" : undefined} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/60">
            <div><CardTitle className="text-base">Réservations récentes</CardTitle><p className="mt-1 text-sm text-muted-foreground">Les derniers dossiers créés par l’équipe.</p></div>
            <Button asChild variant="ghost" size="sm"><Link href="/agency/reservations">Tout voir <ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent className="px-0">
            {recent && recent.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Référence</TableHead><TableHead>Client</TableHead><TableHead>Véhicule</TableHead><TableHead>Total</TableHead><TableHead>État</TableHead></TableRow></TableHeader>
                <TableBody>
                  {recent.map((r) => {
                    const customer = r.customers as unknown as { first_name: string; last_name: string };
                    const vehicle = r.vehicles as unknown as { brand: string; model: string };
                    return <TableRow key={r.id}>
                      <TableCell><Link href={`/agency/reservations/${r.id}`} className="font-medium hover:underline">{r.reference}</Link><span className="block text-xs text-muted-foreground">{formatDate(r.start_date)} → {formatDate(r.end_date)}</span></TableCell>
                      <TableCell className="text-sm">{customer.first_name} {customer.last_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{vehicle.brand} {vehicle.model}</TableCell>
                      <TableCell className="text-sm tabular-nums">{formatCurrency(Number(r.total_amount))}</TableCell>
                      <TableCell><StatusBadge meta={RESERVATION_STATUS[r.status]} /></TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            ) : <Empty text="Aucune réservation pour le moment." href="/agency/reservations/new" action="Créer une réservation" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">À surveiller</CardTitle><p className="text-sm text-muted-foreground">Les points qui demandent une décision.</p></CardHeader>
          <CardContent className="space-y-1">
            {dashboardData.alerts.length > 0 ? dashboardData.alerts.slice(0, 5).map((alert) => <Link key={`${alert.title}-${alert.href}`} href={alert.href} className="block rounded-xl px-3 py-3 transition-colors hover:bg-muted/60"><p className="text-sm font-medium">{alert.title}</p><p className="mt-1 text-xs text-muted-foreground">{alert.description}</p></Link>) : <p className="py-3 text-sm text-muted-foreground">Aucune alerte urgente.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Accès rapides :</span>
        <QuickLink href="/agency/customers/new" icon={Contact} label="Ajouter un client" />
        <QuickLink href="/agency/reservations/new" icon={CalendarCheck} label="Nouvelle réservation" />
      </div>
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: "warning" }) {
  return <div className="px-4 py-4 sm:px-5 sm:py-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-semibold tracking-tight tabular-nums ${tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{value}</p></div>;
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof Contact; label: string }) {
  return <Link href={href} className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"><Icon className="size-3.5 text-primary" />{label}</Link>;
}

function Empty({ text, href, action }: { text: string; href: string; action: string }) {
  return <div className="flex items-center justify-between px-5 py-8 text-sm text-muted-foreground"><span>{text}</span><Link href={href} className="font-medium text-primary hover:underline">{action}</Link></div>;
}
