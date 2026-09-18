import Link from "next/link";
import { ArrowRight, CalendarClock, CarFront, CircleAlert, ClipboardCheck, CreditCard, FileWarning, PackageCheck, Plus, ShieldCheck } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getTodayOverview } from "@/lib/services/today-overview";
import { PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { startPerf } from "@/lib/perf";

export const metadata = { title: "Aujourd’hui — FleetHub" };

export default async function TodayPage() {
  const stopPagePerf = startPerf("today.page.total");
  const ctx = await requireAgency();
  const s = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date());
  const data = await getTodayOverview(s, ctx.membership.agencyId, ctx.membership.branchId, today);
  const totalActions = data.departures.length + data.returns.length + data.preparations.length + data.missions.length + data.metrics.lateReturns + (data.metrics.unpaidBalances > 0 ? 1 : 0) + data.deposits.length + data.metrics.documentAlerts;
  stopPagePerf();

  return (
    <>
      <PageHeader
        title="Aujourd’hui"
        description={totalActions ? `${totalActions} action${totalActions > 1 ? "s" : ""} prioritaire${totalActions > 1 ? "s" : ""} pour votre agence.` : "Tout est calme pour le moment."}
        action={<Button asChild size="sm"><Link href="/agency/reservations/new"><Plus /> Nouvelle réservation</Link></Button>}
      />

      <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border/70 py-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2"><CalendarClock className="size-4 text-primary" />{data.metrics.pickupsToday} départs</span>
        <span className="inline-flex items-center gap-2"><PackageCheck className="size-4 text-primary" />{data.metrics.returnsToday} retours</span>
        <span className="inline-flex items-center gap-2"><CreditCard className="size-4 text-primary" />{formatCurrency(data.metrics.unpaidBalances)} à encaisser</span>
        <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-primary" />{formatCurrency(data.metrics.depositsHeld)} de cautions détenues</span>
      </div>

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <ActionSection title="Départs aujourd’hui" icon={CalendarClock} count={data.departures.length} empty="Aucun départ prévu aujourd’hui.">
          {data.departures.map((row) => <ActionRow key={row.id} title={row.customer_name} subtitle={`${row.reference} · ${row.vehicle_name ?? "Véhicule à attribuer"}`} href={`/agency/reservations/${row.id}`} action="Préparer" />)}
        </ActionSection>

        <ActionSection title="Retours aujourd’hui" icon={PackageCheck} count={data.returns.length} empty="Aucun retour prévu aujourd’hui.">
          {data.returns.map((row) => <ActionRow key={row.id} title={row.customer_name} subtitle={`${row.contract_number} · ${row.vehicle_name}`} href={`/agency/contracts/${row.id}#check-in`} action="Enregistrer le retour" />)}
        </ActionSection>

        <ActionSection title="Retards" icon={CircleAlert} count={data.metrics.lateReturns} empty="Aucun véhicule en retard.">
          {data.metrics.lateReturns > 0 && <ActionRow title={`${data.metrics.lateReturns} location${data.metrics.lateReturns > 1 ? "s" : ""} à relancer`} subtitle="Vérifiez le retour et contactez le client." href="/agency/contracts" action="Voir les locations" tone="warning" />}
        </ActionSection>

        <ActionSection title="À préparer" icon={ClipboardCheck} count={data.preparations.length} empty="Aucune préparation en attente.">
          {data.preparations.map((row) => <ActionRow key={row.id} title={row.contract_number ?? "Location à identifier"} subtitle={row.status === "BLOCKED" ? "Préparation bloquée" : "Checklist à terminer"} href={row.contract_id ? `/agency/contracts/${row.contract_id}#preparation` : "/agency/contracts"} action="Préparer" tone={row.status === "BLOCKED" ? "warning" : undefined} />)}
        </ActionSection>

        <ActionSection title="À encaisser" icon={CreditCard} count={data.metrics.unpaidBalances > 0 ? 1 : 0} empty="Aucun solde à encaisser.">
          {data.metrics.unpaidBalances > 0 && <ActionRow title={formatCurrency(data.metrics.unpaidBalances)} subtitle="Soldes de locations en cours" href="/agency/payments" action="Encaisser" />}
        </ActionSection>

        <ActionSection title="Cautions à régler" icon={ShieldCheck} count={data.deposits.length} empty="Aucune caution à traiter.">
          {data.deposits.map((row) => <ActionRow key={row.id} title={row.contract_number ?? "Location à identifier"} subtitle={`${row.status === "PARTIALLY_DEDUCTED" ? "Déduction à finaliser" : "Caution détenue"} · ${formatCurrency(Number(row.held_amount))}`} href={row.contract_id ? `/agency/contracts/${row.contract_id}#caution` : "/agency/contracts"} action="Régler la caution" />)}
        </ActionSection>

        <ActionSection title="Livraisons planifiées" icon={CarFront} count={data.missions.length} empty="Aucune livraison planifiée.">
          {data.missions.map((row) => <ActionRow key={row.id} title={row.mission_type === "AIRPORT_DELIVERY" ? "Livraison aéroport" : row.mission_type === "HOTEL_DELIVERY" ? "Livraison hôtel" : "Mission de livraison"} subtitle={`${row.address ?? "Adresse à confirmer"} · ${row.vehicle_name ?? "Véhicule à identifier"}`} href="/agency/operations" action="Voir la mission" />)}
        </ActionSection>

        <ActionSection title="Alertes documents & entretien" icon={FileWarning} count={data.metrics.documentAlerts} empty="Aucune alerte urgente.">
          {data.alerts.map((row) => <ActionRow key={`${row.id}-${row.href}`} title={row.title} subtitle={row.subtitle} href={row.href} action="Vérifier" tone={row.tone} />)}
        </ActionSection>
      </div>
    </>
  );
}

function ActionSection({ title, icon: Icon, count, empty, children }: { title: string; icon: typeof CalendarClock; count: number; empty: string; children: React.ReactNode }) {
  return <section className="min-w-0"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-primary" />{title}</h2><span className="text-xs tabular-nums text-muted-foreground">{count}</span></div>{count > 0 ? <div className="divide-y divide-border/60 border-y border-border/70">{children}</div> : <p className="border-y border-border/70 py-4 text-sm text-muted-foreground">{empty}</p>}</section>;
}

function ActionRow({ title, subtitle, href, action, tone }: { title: string; subtitle: string; href: string; action: string; tone?: "warning" }) {
  return <div className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className={`truncate text-sm font-medium ${tone === "warning" ? "text-amber-700 dark:text-amber-400" : ""}`}>{title}</p><p className="truncate text-xs text-muted-foreground">{subtitle}</p></div><Link href={href} className="shrink-0 text-xs font-semibold text-primary hover:underline">{action}<ArrowRight className="ml-1 inline size-3.5" /></Link></div>;
}
