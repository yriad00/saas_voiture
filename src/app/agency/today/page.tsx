/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { ArrowRight, CalendarClock, CarFront, CircleAlert, ClipboardCheck, CreditCard, FileWarning, PackageCheck, Plus, ShieldCheck } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/services/dashboard";
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
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowDate = tomorrow.toISOString().slice(0, 10);
  const expiryAlertDateValue = new Date(`${today}T12:00:00Z`);
  expiryAlertDateValue.setUTCDate(expiryAlertDateValue.getUTCDate() + 30);
  const expiryAlertDate = expiryAlertDateValue.toISOString().slice(0, 10);

  const [data, pickups, returns, missions, preparations, deposits, maintenance, expiringVehicles, expiringCustomers, expiringVehicleDocuments, expiringCustomerDocuments, customerLookup, vehicleLookup, contractLookup] = await Promise.all([
    getDashboardData(ctx.membership.agencyId),
    s.from("reservations").select("id,reference,customer_id,vehicle_id,start_date,end_date").eq("agency_id", ctx.membership.agencyId).eq("start_date", today).in("status", ["CONFIRMED", "ONGOING"]).limit(20),
    s.from("contracts").select("id,contract_number,customer_id,vehicle_id,end_date").eq("agency_id", ctx.membership.agencyId).eq("end_date", today).eq("status", "ACTIVE").limit(20),
    (s as any).from("delivery_missions").select("id,mission_type,address,scheduled_at,status,vehicle_id,customer_id").eq("agency_id", ctx.membership.agencyId).gte("scheduled_at", `${today}T00:00:00Z`).lt("scheduled_at", `${tomorrowDate}T00:00:00Z`).in("status", ["PLANNED", "PREPARING", "READY", "ACCEPTED", "ON_THE_WAY", "ARRIVED"]).order("scheduled_at").limit(20),
    s.from("vehicle_preparations").select("id,contract_id,status").eq("agency_id", ctx.membership.agencyId).in("status", ["IN_PROGRESS", "BLOCKED"]).limit(20),
    (s as any).from("deposits").select("id,contract_id,status,held_amount").eq("agency_id", ctx.membership.agencyId).in("status", ["RECEIVED", "HELD", "PARTIALLY_DEDUCTED"]).limit(20),
    s.from("maintenance_records").select("id,vehicle_id,next_service_date,status").eq("agency_id", ctx.membership.agencyId).eq("status", "SCHEDULED").lte("next_service_date", tomorrowDate).limit(20),
    s.from("vehicles").select("id,brand,model,license_plate,insurance_expiry,technical_inspection_expiry").eq("agency_id", ctx.membership.agencyId).is("deleted_at", null).or(`insurance_expiry.lte.${expiryAlertDate},technical_inspection_expiry.lte.${expiryAlertDate}`).limit(20),
    s.from("customers").select("id,first_name,last_name,id_expiry,driver_license_expiry,passport_expiry").eq("agency_id", ctx.membership.agencyId).is("deleted_at", null).or(`id_expiry.lte.${expiryAlertDate},driver_license_expiry.lte.${expiryAlertDate},passport_expiry.lte.${expiryAlertDate}`).limit(20),
    (s as any).from("vehicle_documents").select("id,vehicle_id,document_type,expires_at").eq("agency_id", ctx.membership.agencyId).not("expires_at", "is", null).lte("expires_at", expiryAlertDate).order("expires_at").limit(20),
    (s as any).from("customer_documents").select("id,customer_id,document_type,expires_at").eq("agency_id", ctx.membership.agencyId).not("expires_at", "is", null).lte("expires_at", expiryAlertDate).order("expires_at").limit(20),
    s.from("customers").select("id,first_name,last_name").eq("agency_id", ctx.membership.agencyId).is("deleted_at", null).limit(250),
    s.from("vehicles").select("id,brand,model,license_plate").eq("agency_id", ctx.membership.agencyId).is("deleted_at", null).limit(250),
    s.from("contracts").select("id,contract_number").eq("agency_id", ctx.membership.agencyId).limit(250),
  ]);

  const { data: customers } = customerLookup;
  const { data: vehicles } = vehicleLookup;
  const { data: contracts } = contractLookup;

  const customerName = (id?: string | null) => {
    const customer = (customers ?? []).find((row) => row.id === id);
    return customer ? `${customer.first_name} ${customer.last_name}` : "Client à identifier";
  };
  const vehicleName = (id?: string | null) => {
    const vehicle = (vehicles ?? []).find((row) => row.id === id);
    return vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.license_plate}` : "Véhicule à identifier";
  };
  const contractName = (id?: string | null) => (contracts ?? []).find((row) => row.id === id)?.contract_number ?? "Location à identifier";
  const documentAlerts = (expiringVehicles.data?.length ?? 0) + (expiringCustomers.data?.length ?? 0) + (expiringVehicleDocuments.data?.length ?? 0) + (expiringCustomerDocuments.data?.length ?? 0);
  const totalActions = (pickups.data?.length ?? 0) + (returns.data?.length ?? 0) + (preparations.data?.length ?? 0) + (missions.data?.length ?? 0) + (data.metrics.lateReturns ?? 0) + (data.metrics.unpaidBalances > 0 ? 1 : 0) + (deposits.data?.length ?? 0) + documentAlerts;
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
        <ActionSection title="Départs aujourd’hui" icon={CalendarClock} count={pickups.data?.length ?? 0} empty="Aucun départ prévu aujourd’hui.">
          {(pickups.data ?? []).map((row: any) => <ActionRow key={row.id} title={customerName(row.customer_id)} subtitle={`${row.reference} · ${vehicleName(row.vehicle_id)}`} href={`/agency/reservations/${row.id}`} action="Préparer" />)}
        </ActionSection>

        <ActionSection title="Retours aujourd’hui" icon={PackageCheck} count={returns.data?.length ?? 0} empty="Aucun retour prévu aujourd’hui.">
          {(returns.data ?? []).map((row: any) => <ActionRow key={row.id} title={customerName(row.customer_id)} subtitle={`${row.contract_number} · ${vehicleName(row.vehicle_id)}`} href={`/agency/contracts/${row.id}#check-in`} action="Enregistrer le retour" />)}
        </ActionSection>

        <ActionSection title="Retards" icon={CircleAlert} count={data.metrics.lateReturns} empty="Aucun véhicule en retard.">
          {data.metrics.lateReturns > 0 && <ActionRow title={`${data.metrics.lateReturns} location${data.metrics.lateReturns > 1 ? "s" : ""} à relancer`} subtitle="Vérifiez le retour et contactez le client." href="/agency/contracts" action="Voir les locations" tone="warning" />}
        </ActionSection>

        <ActionSection title="À préparer" icon={ClipboardCheck} count={preparations.data?.length ?? 0} empty="Aucune préparation en attente.">
          {(preparations.data ?? []).map((row: any) => <ActionRow key={row.id} title={contractName(row.contract_id)} subtitle={row.status === "BLOCKED" ? "Préparation bloquée" : "Checklist à terminer"} href={`/agency/contracts/${row.contract_id}#preparation`} action="Préparer" tone={row.status === "BLOCKED" ? "warning" : undefined} />)}
        </ActionSection>

        <ActionSection title="À encaisser" icon={CreditCard} count={data.metrics.unpaidBalances > 0 ? 1 : 0} empty="Aucun solde à encaisser.">
          {data.metrics.unpaidBalances > 0 && <ActionRow title={formatCurrency(data.metrics.unpaidBalances)} subtitle="Soldes de locations en cours" href="/agency/payments" action="Encaisser" />}
        </ActionSection>

        <ActionSection title="Cautions à régler" icon={ShieldCheck} count={deposits.data?.length ?? 0} empty="Aucune caution à traiter.">
          {(deposits.data ?? []).map((row: any) => <ActionRow key={row.id} title={contractName(row.contract_id)} subtitle={`${row.status === "PARTIALLY_DEDUCTED" ? "Déduction à finaliser" : "Caution détenue"} · ${formatCurrency(Number(row.held_amount))}`} href={`/agency/contracts/${row.contract_id}#caution`} action="Régler la caution" />)}
        </ActionSection>

        <ActionSection title="Livraisons planifiées" icon={CarFront} count={missions.data?.length ?? 0} empty="Aucune livraison planifiée.">
          {(missions.data ?? []).map((row: any) => <ActionRow key={row.id} title={row.mission_type === "AIRPORT_DELIVERY" ? "Livraison aéroport" : row.mission_type === "HOTEL_DELIVERY" ? "Livraison hôtel" : "Mission de livraison"} subtitle={`${row.address ?? "Adresse à confirmer"} · ${vehicleName(row.vehicle_id)}`} href="/agency/operations" action="Voir la mission" />)}
        </ActionSection>

        <ActionSection title="Alertes documents & entretien" icon={FileWarning} count={(maintenance.data?.length ?? 0) + documentAlerts} empty="Aucune alerte urgente.">
          {(maintenance.data ?? []).slice(0, 3).map((row: any) => <ActionRow key={`m-${row.id}`} title={vehicleName(row.vehicle_id)} subtitle={`Entretien à prévoir le ${row.next_service_date ?? "bientôt"}`} href="/agency/maintenance" action="Voir l’entretien" />)}
          {(expiringVehicles.data ?? []).slice(0, 3).map((row: any) => <ActionRow key={`v-${row.id}`} title={`${row.brand} ${row.model}`} subtitle={`Document véhicule à vérifier · ${row.license_plate}`} href={`/agency/fleet/${row.id}`} action="Vérifier" tone="warning" />)}
          {(expiringCustomers.data ?? []).slice(0, 3).map((row: any) => <ActionRow key={`c-${row.id}`} title={`${row.first_name} ${row.last_name}`} subtitle="Pièce d’identité ou permis à vérifier" href={`/agency/customers/${row.id}`} action="Vérifier" tone="warning" />)}
          {(expiringVehicleDocuments.data ?? []).slice(0, 3).map((row: any) => <ActionRow key={`vd-${row.id}`} title={vehicleName(row.vehicle_id)} subtitle={`Document véhicule à vérifier · expire le ${row.expires_at}`} href={`/agency/fleet/${row.vehicle_id}`} action="Vérifier" tone="warning" />)}
          {(expiringCustomerDocuments.data ?? []).slice(0, 3).map((row: any) => <ActionRow key={`cd-${row.id}`} title={customerName(row.customer_id)} subtitle={`Document client à vérifier · expire le ${row.expires_at}`} href={`/agency/customers/${row.customer_id}`} action="Vérifier" tone="warning" />)}
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

