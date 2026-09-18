/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, CarFront, Calendar, Wallet, Plus } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getContract } from "@/lib/services/contracts";
import { listActiveExtras, getContractExtras } from "@/lib/services/extras";
import { ExtraAssignmentForm } from "@/app/agency/extras/assignment-form";
import { RemoveExtraButton } from "@/app/agency/extras/remove-button";
import { PreparationForm } from "./preparation-form";
import { CheckoutForm } from "./checkout-form";
import { ActiveRentalForm } from "./active-rental-form";
import { ExtensionForm } from "./extension-form";
import { SwapForm } from "./swap-form";
import { CheckinForm } from "./checkin-form";
import { ReturnChargeOverride } from "./return-charge-override";
import { DepositForm } from "./deposit-form";
import { SignatureForm } from "./signature-form";
import { ContractActions } from "./contract-actions";
import { InvoiceButton } from "../invoice-button";
import { FinancialDocumentButtons } from "../financial-document-buttons";
import { InspectionForm } from "./inspection-form";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CONTRACT_STATUS, PAYMENT_METHOD, PAYMENT_TYPE, PAYMENT_STATUS } from "@/lib/labels";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { ContractPrintDocument } from "./contract-print-document";
import { ParticipantForm } from "./participant-form";
import { OwnerSettlementForm } from "./owner-settlement-form";
import { EarlyReturnForm } from "./early-return-form";
import { measurePerf, startPerf } from "@/lib/perf";

function fuel(level: number | null) {
  return level === null ? "—" : `${level}/8`;
}

function depositStatusLabel(status: string) {
  return ({ RECEIVED: "Reçue", HELD: "Détenue", PARTIALLY_DEDUCTED: "Partiellement déduite", PARTIALLY_REFUNDED: "Partiellement remboursée", REFUNDED: "Remboursée", CLOSED: "Clôturée" } as Record<string, string>)[status] ?? "À traiter";
}

function settlementStatusLabel(status: string) {
  return ({ UNPAID: "À régler", PARTIAL: "Partiellement réglé", PAID: "Réglé" } as Record<string, string>)[status] ?? "À régler";
}

function chargeTypeLabel(type: string) {
  return ({ LATE_RETURN: "Retard", EXTRA_TIME: "Temps supplémentaire", EXTRA_MILEAGE: "Kilométrage supplémentaire", FUEL: "Carburant", CLEANING: "Nettoyage", DAMAGE: "Dommage", MISSING_ITEM: "Équipement manquant", OTHER: "Autre" } as Record<string, string>)[type] ?? "Frais de retour";
}

function chargeSourceLabel(source: string) {
  return ({ AUTOMATIC: "Calculé automatiquement", MANUAL: "Ajouté par l’agence", OVERRIDE: "Ajusté par un responsable" } as Record<string, string>)[source] ?? "Frais de retour";
}

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const stopPagePerf = startPerf("contract.page.total");
  const ctx = await requireAgency();
  const { id } = await params;
  const c = await getContract(id, ctx.membership.agencyId);
  if (!c) notFound();
  const deposit = c.deposit;
  const supabase = await createClient();
  const [{ data: agency }, { data: agencySettings }, { data: branches }] = await measurePerf("contract.page.agencyConfig", () => Promise.all([
    supabase.from("agencies").select("name,address,city,phone,email,logo_url,currency").eq("id", ctx.membership.agencyId).maybeSingle(),
    supabase.from("agency_settings").select("extra").eq("agency_id", ctx.membership.agencyId).maybeSingle(),
    supabase.from("branches").select("id,name").eq("agency_id", ctx.membership.agencyId).eq("active", true).order("name"),
  ]));
  const [{ data: extras }, { data: assignedExtras }] = await measurePerf("contract.page.extras", () => Promise.all([
    listActiveExtras(supabase, ctx.membership.agencyId, c.branch_id),
    getContractExtras(supabase, id, ctx.membership.agencyId),
  ]));
  const [{ data: rentalParticipants }, { data: participantCustomers }] = await measurePerf("contract.page.participants", () => Promise.all([
    (supabase as any).from("rental_participants").select("customer_id,role").eq("contract_id", id).eq("agency_id", ctx.membership.agencyId),
    supabase.from("customers").select("id,first_name,last_name").eq("agency_id", ctx.membership.agencyId).is("deleted_at", null).order("last_name").limit(200),
  ]));
  // These dossier panels are independent reads. Keep them in one parallel
  // batch so opening a rental does not pay the latency of eight sequential
  // round trips. Each query remains scoped by agency + contract for RLS.
  const ownerSettlementQuery = c.vehicle.ownership_type === "SUBLEASE"
    ? (supabase as any).from("vehicle_owner_settlements").select("id,owner_amount,paid_amount,status,notes").eq("contract_id", id).eq("agency_id", ctx.membership.agencyId).maybeSingle()
    : Promise.resolve({ data: null });
  const [
    { data: ownerSettlement },
    { data: preparation },
    { data: checkout },
    { data: checkin },
    { data: signatures },
    { data: rentalUpdates },
    { data: extensions },
  ] = await measurePerf("contract.page.dossierPanels", () => Promise.all([
    ownerSettlementQuery,
    supabase.from("vehicle_preparations").select("*").eq("contract_id", id).eq("agency_id", ctx.membership.agencyId).maybeSingle(),
    supabase.from("contract_checkouts").select("*").eq("contract_id", id).eq("agency_id", ctx.membership.agencyId).maybeSingle(),
    (supabase as any).from("contract_checkins").select("*").eq("contract_id", id).eq("agency_id", ctx.membership.agencyId).maybeSingle(),
    (supabase as any).from("contract_signatures").select("id,signer_type,signer_name,signature_data,signed_at,contract_version").eq("contract_id", id).eq("agency_id", ctx.membership.agencyId).order("signed_at", { ascending: false }),
    supabase.from("active_rental_updates").select("id, event_type, occurred_at, mileage, fuel_level, location, notes").eq("contract_id", id).eq("agency_id", ctx.membership.agencyId).order("occurred_at", { ascending: false }).limit(20),
    supabase.from("rental_extensions").select("id, previous_end_date, new_end_date, added_days, extra_amount, reason, created_at").eq("contract_id", id).eq("agency_id", ctx.membership.agencyId).order("created_at", { ascending: false }),
  ]));
  let swapVehicleQuery = supabase.from("vehicles").select("id, brand, model, license_plate").eq("agency_id", ctx.membership.agencyId).eq("status", "AVAILABLE").is("deleted_at", null).neq("id", c.vehicle.id).order("brand");
  swapVehicleQuery = c.branch_id ? swapVehicleQuery.eq("branch_id", c.branch_id) : swapVehicleQuery.is("branch_id", null);
  const [{ data: swapVehicles }, { data: swaps }] = await measurePerf("contract.page.swapHistory", () => Promise.all([
    swapVehicleQuery,
    supabase.from("vehicle_swaps").select("id, old_vehicle_id, new_vehicle_id, reason, created_at").eq("contract_id", id).eq("agency_id", ctx.membership.agencyId).order("created_at", { ascending: false }),
  ]));

  const canWrite = ["AGENCY_OWNER", "MANAGER", "AGENT"].includes(ctx.membership.roleKey);
  const canRecordPayment = ["AGENCY_OWNER", "MANAGER", "ACCOUNTANT"].includes(ctx.membership.roleKey);
  const canManage = ["AGENCY_OWNER", "MANAGER"].includes(ctx.membership.roleKey);
  const returnBranchId = String((c as any).return_branch_id ?? c.branch_id ?? ctx.membership.branchId ?? "");
  const canPerformReturnHere = !ctx.membership.branchId || ctx.membership.branchId === returnBranchId;
  const balance = c.financials.amountDue;
  const expectedReturnAt = (c as any).end_at ?? `${c.end_date}T00:00:00.000Z`;
  const lateReturn = c.status === "ACTIVE" && new Date(expectedReturnAt).getTime() < new Date().getTime();
  const pickupInspection = c.inspections.find((inspection) => inspection.inspection_type === "PICKUP");
  const returnInspection = c.inspections.find((inspection) => inspection.inspection_type === "RETURN");
  const pickupPhotos = c.photos.filter((photo) => photo.inspection_type === "PICKUP");
  const returnPhotos = c.photos.filter((photo) => photo.inspection_type === "RETURN");
  const earlyReturnPolicy = String((c as any).early_return_policy ?? "MANAGER_DECISION");
  const earlyReturnDecision = (c as any).early_return_decision as string | null | undefined;
  const earlyReturn = c.status === "ACTIVE" && checkin?.status === "FINALIZED" && new Date(checkin.actual_return_at).getTime() < new Date(expectedReturnAt).getTime();
  const nextAction = ["CLOSED", "CANCELLED"].includes(c.status)
    ? null
    : c.status === "DRAFT"
    ? { label: "Préparer et démarrer la location", href: "#preparation", hint: "Vérifiez les signatures et le véhicule avant la remise." }
    : c.status === "ACTIVE" && preparation?.status !== "READY" && !checkout
      ? { label: "Préparer le véhicule", href: "#preparation", hint: "Validez le nettoyage, le carburant et les documents avant la remise." }
    : !checkout
      ? { label: "Remettre le véhicule", href: "#check-out", hint: "Saisissez le kilométrage, le carburant et les photos de départ." }
      : !checkin || checkin.status !== "FINALIZED"
        ? { label: "Enregistrer le retour", href: "#check-in", hint: "Faites l’état des lieux et révisez les charges." }
        : balance > 0
          ? canRecordPayment
            ? { label: "Régler le solde", href: `/agency/payments/new?contract=${c.id}`, hint: `Il reste ${formatCurrency(balance)} à encaisser.` }
            : { label: "Solde à encaisser", href: "#finances", hint: `Il reste ${formatCurrency(balance)} à encaisser par un responsable.` }
          : deposit && !["REFUNDED", "CLOSED"].includes(deposit.status)
            ? canRecordPayment
              ? { label: "Régler la caution", href: "#caution", hint: "Déduisez les frais éventuels puis remboursez le reliquat." }
              : { label: "Caution à régler", href: "#caution", hint: "Le responsable financier doit régler la caution." }
            : c.status === "ACTIVE" && canWrite
              ? { label: "Clôturer la location", href: "#cloture", hint: "Le retour et le règlement sont prêts à être clôturés." }
              : null;
  const progressSteps = ["Réservé", "Confirmé", "Préparation", "Prêt", "Loué", "Retour", "Règlement", "Clôturé"];
  const progressIndex = c.status === "CLOSED"
    ? 7
    : checkin?.status === "FINALIZED"
      ? (balance > 0 || (deposit && !["REFUNDED", "CLOSED"].includes(deposit.status)) ? 6 : 7)
      : checkout
        ? 4
        : preparation?.status === "READY"
          ? 3
          : preparation
            ? 2
            : c.status === "ACTIVE"
              ? 1
              : 0;

  stopPagePerf();

  return (
    <>
    <ContractPrintDocument agency={agency} agencyExtra={(agencySettings?.extra ?? {}) as Record<string, unknown>} contract={c} extras={assignedExtras ?? []} deposit={deposit} signatures={signatures ?? []} />
    <div className="space-y-6 print:hidden">
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          {agency?.logo_url && <img src={agency.logo_url} alt="Logo agence" className="h-14 w-14 rounded object-contain" />}
          <div><h2 className="text-xl font-semibold">{agency?.name ?? ctx.membership.agencyName}</h2><p className="text-xs text-muted-foreground">{[agency?.address, agency?.city].filter(Boolean).join(" · ")}</p><p className="text-xs text-muted-foreground">{[agency?.phone, agency?.email].filter(Boolean).join(" · ")}</p></div>
        </div>
        <div className="text-left text-xs text-muted-foreground sm:text-right"><p>ICE : {String((agencySettings?.extra as any)?.ice ?? "—")}</p><p>IF : {String((agencySettings?.extra as any)?.tax_id ?? "—")}</p><p>RC : {String((agencySettings?.extra as any)?.rc_number ?? "—")}</p><p>Contrat {c.contract_number}</p><p>Généré le {formatDate(new Date().toISOString())}</p></div>
      </div>
      <Button asChild variant="ghost" size="sm">
        <Link href="/agency/contracts"><ArrowLeft /> Retour aux contrats</Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{c.contract_number}</h1>
            <StatusBadge meta={CONTRACT_STATUS[c.status]} />
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDate(c.start_date)} → {formatDate(c.end_date)}
            {c.reservationRef && <> · depuis réservation {c.reservationRef}</>}
          </p>
        </div>
        <div className="space-y-2">
          <div id="cloture" className="flex flex-wrap gap-2 print:hidden">
            <PrintButton label="Imprimer le contrat" />
            {canWrite && <ContractActions contractId={c.id} status={c.status} />}
            {canRecordPayment && ["ACTIVE", "CLOSED"].includes(c.status) && c.invoices.length === 0 && <InvoiceButton contractId={c.id} />}
            {canRecordPayment && <FinancialDocumentButtons contractId={c.id} />}
          </div>
        </div>
      </div>

      <div aria-label="Progression de la location" className="overflow-x-auto rounded-2xl border border-border/70 bg-card/60 px-4 py-4">
        <div className="flex min-w-[680px] items-start">
          {progressSteps.map((step, index) => <div key={step} className="flex flex-1 items-start">
            <div className="flex min-w-0 flex-col items-center gap-2 text-center">
              <span className={`flex size-7 items-center justify-center rounded-full border text-xs font-semibold ${index <= progressIndex ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}>{index + 1}</span>
              <span className={`text-[11px] font-medium ${index <= progressIndex ? "text-foreground" : "text-muted-foreground"}`}>{step}</span>
            </div>
            {index < progressSteps.length - 1 && <span className={`mt-3 h-px flex-1 ${index < progressIndex ? "bg-primary" : "bg-border"}`} />}
          </div>)}
        </div>
      </div>

      {nextAction && <Card className="border-primary/30 bg-primary/5"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Prochaine action</p><p className="text-sm text-muted-foreground">{nextAction.hint}</p></div><Button asChild size="sm"><Link href={nextAction.href}>{nextAction.label}</Link></Button></CardContent></Card>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="size-4" /> Client</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Link href={`/agency/customers/${c.customer.id}`} className="font-medium hover:underline">{c.customer.name}</Link>
            {c.customer.phone && <p className="text-muted-foreground">{c.customer.phone}</p>}
            {c.customer.email && <p className="text-muted-foreground">{c.customer.email}</p>}
            <p className="text-xs text-muted-foreground">Pièce : {c.customer.id_number ?? "—"} · Permis : {c.customer.driver_license_number ?? "—"}</p>
            <WhatsAppLink phone={c.customer.whatsapp ?? c.customer.phone} message={`Bonjour ${c.customer.name}, votre contrat ${c.contract_number} est disponible.`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CarFront className="size-4" /> Véhicule</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Link href={`/agency/fleet/${c.vehicle.id}`} className="font-medium hover:underline">{c.vehicle.label}</Link>
            <p className="font-mono text-muted-foreground">{c.vehicle.plate}</p>
            <p className="text-xs text-muted-foreground">Départ : {c.start_mileage ?? "—"} km · carburant {fuel(c.fuel_level_start)}</p>
            <p className="text-xs text-muted-foreground">Prise en charge : {c.pickupLocation ?? "—"} · retour : {c.returnLocation ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calendar className="size-4" /> État du véhicule</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Km départ" value={c.start_mileage ? c.start_mileage.toLocaleString("fr-MA") : "—"} />
            <Info label="Km retour" value={c.end_mileage ? c.end_mileage.toLocaleString("fr-MA") : "—"} />
            <Info label="Carburant départ" value={fuel(c.fuel_level_start)} />
            <Info label="Carburant retour" value={fuel(c.fuel_level_end)} />
          </CardContent>
        </Card>
      </div>

      <Card id="participants">
        <CardHeader><CardTitle className="text-base">Participants de la location</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Le payeur peut être différent du conducteur. Les rôles restent liés à ce dossier.</p>
          {canWrite && c.status !== "CLOSED" && c.status !== "CANCELLED" && <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Modifier payeur et conducteurs</summary><div className="mt-4"><ParticipantForm contractId={c.id} customers={participantCustomers ?? []} payerId={(c as any).payer_customer_id} driverId={(c as any).principal_driver_customer_id} additionalDriverIds={(rentalParticipants ?? []).filter((p: any) => p.role === "ADDITIONAL_DRIVER").map((p: any) => p.customer_id)} /></div></details>}
          {(rentalParticipants ?? []).length > 0 && <div className="flex flex-wrap gap-2 text-xs">{(rentalParticipants ?? []).map((p: any) => { const person = (participantCustomers ?? []).find((x) => x.id === p.customer_id); return <span key={`${p.role}-${p.customer_id}`} className="rounded-full border px-2 py-1">{p.role === "PAYER" ? "Payeur" : p.role === "PRINCIPAL_DRIVER" ? "Conducteur principal" : "Conducteur additionnel"} : {person ? `${person.first_name} ${person.last_name}` : p.customer_id.slice(0, 8)}</span>; })}</div>}
        </CardContent>
      </Card>

      {c.vehicle.ownership_type === "SUBLEASE" && <Card><CardHeader><CardTitle className="text-base">Règlement propriétaire</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-xs text-muted-foreground">Revenu location : {formatCurrency(c.financials.grandTotal)} · Propriétaire : {c.vehicle.owner_name ?? "—"}</p><OwnerSettlementForm contractId={c.id} currentOwnerAmount={Number(ownerSettlement?.owner_amount ?? ((c.vehicle.owner_cost_per_day ?? 0) * Math.max(1, Math.ceil((new Date(c.end_date).getTime() - new Date(c.start_date).getTime()) / 86400000))))} currentPaidAmount={Number(ownerSettlement?.paid_amount ?? 0)} /><p className="text-xs text-muted-foreground">Statut : {settlementStatusLabel(ownerSettlement?.status ?? "UNPAID")} · Marge agence estimée : {formatCurrency(c.financials.grandTotal - Number(ownerSettlement?.owner_amount ?? 0))}</p></CardContent></Card>}

      {earlyReturn && <Card><CardHeader><CardTitle className="text-base">Retour anticipé</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-xs text-muted-foreground">Le véhicule a été rendu avant la date prévue. Politique configurée : {earlyReturnPolicy}.</p>{canManage ? <EarlyReturnForm contractId={c.id} policy={earlyReturnPolicy} decision={earlyReturnDecision} /> : <p className="text-sm text-muted-foreground">Une décision manager est requise pour régler ce retour anticipé.</p>}{earlyReturnDecision && <p className="text-xs text-muted-foreground">Décision enregistrée : {earlyReturnDecision}</p>}</CardContent></Card>}

      <Card id="finances">
        <CardHeader><CardTitle className="text-base">Finances</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Info label="Tarif / jour" value={formatCurrency(Number(c.daily_rate))} />
          <Info label="Caution" value={formatCurrency(Number(c.deposit_amount))} />
          <Info label="Total contrat" value={formatCurrency(c.financials.grandTotal)} />
          <Info label="Charges retour" value={formatCurrency(c.financials.returnChargesTotal)} />
          <Info label="Loyers encaissés" value={formatCurrency(c.financials.rentalPaidTotal)} />
          <Info label="Caution encore détenue" value={formatCurrency(c.depositCollected)} />
          <Info label="Remboursements" value={formatCurrency(c.refundTotal)} />
          <div className="col-span-2 sm:col-span-4">
            <div className={`rounded-md border p-3 text-sm ${balance > 0 ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" : "border-green-300 bg-green-50 dark:bg-green-950/30"}`}>
              {balance > 0
                ? <>Solde restant à régler : <strong>{formatCurrency(balance)}</strong></>
                : <>Contrat entièrement réglé.</>}
            </div>
          </div>
        </CardContent>
      </Card>

          {deposit && <Card id="caution"><CardHeader><CardTitle className="text-base">Caution</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5"><Info label="Requise" value={formatCurrency(Number(deposit.required_amount))}/><Info label="Reçue" value={formatCurrency(Number(deposit.received_amount))}/><Info label="Détenue" value={formatCurrency(Number(deposit.held_amount))}/><Info label="Déduite" value={formatCurrency(Number(deposit.deducted_amount))}/><Info label="Remboursée" value={formatCurrency(Number(deposit.refunded_amount))}/></div><p className="text-xs text-muted-foreground">Reste à recevoir : {formatCurrency(Math.max(0, Number(deposit.required_amount) - Number(deposit.received_amount)))} · Disponible à déduire/rembourser : {formatCurrency(Math.max(0, Number(deposit.held_amount) - Number(deposit.deducted_amount) - Number(deposit.refunded_amount)))}</p>{canRecordPayment && c.status !== "CLOSED" && (deposit.branch_id ?? c.branch_id ?? ctx.membership.branchId) && <DepositForm depositId={deposit.id} branchId={(deposit.branch_id ?? c.branch_id ?? ctx.membership.branchId)!} requiredAmount={Number(deposit.required_amount)} receivedAmount={Number(deposit.received_amount)} heldAmount={Math.max(0, Number(deposit.held_amount) - Number(deposit.deducted_amount) - Number(deposit.refunded_amount))}/>}<p className="text-xs text-muted-foreground">Statut : {depositStatusLabel(deposit.status)}. La caution reste séparée du chiffre d’affaires.</p></CardContent></Card>}

      {(checkout || (swaps ?? []).length > 0) && <Card>
        <CardHeader><CardTitle className="text-base">Changer de véhicule</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {canWrite && c.status === "ACTIVE" && checkout && !checkin && <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Remplacer ce véhicule</summary><div className="mt-4"><SwapForm contractId={c.id} vehicles={swapVehicles ?? []} /></div></details>}
          {(swaps ?? []).length ? <div className="space-y-2">{(swaps ?? []).map((swap) => <div key={swap.id} className="rounded-md border p-3 text-sm"><p className="font-medium">Véhicule changé · {formatDate(swap.created_at)}</p><p className="text-xs text-muted-foreground">{swap.reason}</p></div>)}</div> : <p className="text-sm text-muted-foreground">Aucun swap.</p>}
        </CardContent>
      </Card>}

      {(checkout || (extensions ?? []).length > 0) && <Card>
        <CardHeader><CardTitle className="text-base">Prolongation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {canWrite && c.status === "ACTIVE" && checkout && !checkin && <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Prolonger cette location</summary><div className="mt-4"><ExtensionForm contractId={c.id} /></div></details>}
          {(extensions ?? []).length ? <div className="space-y-2">{(extensions ?? []).map((extension) => <div key={extension.id} className="rounded-md border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{formatDate(extension.previous_end_date)} → {formatDate(extension.new_end_date)} · +{extension.added_days} jour(s)</p><p className="font-semibold">{formatCurrency(Number(extension.extra_amount))}</p></div><p className="text-xs text-muted-foreground">{extension.reason}</p></div>)}</div> : <p className="text-sm text-muted-foreground">Aucune prolongation.</p>}
        </CardContent>
      </Card>}

      {(checkout || (rentalUpdates ?? []).length > 0) && <Card>
        <CardHeader><CardTitle className="text-base">Location active</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {canWrite && c.status === "ACTIVE" && checkout && !checkin && <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Ajouter une note ou un événement</summary><div className="mt-4"><ActiveRentalForm contractId={c.id} /></div></details>}
          {(rentalUpdates ?? []).length ? <div className="space-y-2">{(rentalUpdates ?? []).map((event) => <div key={event.id} className="rounded-md border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{event.event_type}</p><span className="text-xs text-muted-foreground">{formatDate(event.occurred_at)}</span></div><p className="mt-1 text-muted-foreground">{event.notes}{event.mileage !== null ? ` · ${event.mileage.toLocaleString("fr-MA")} km` : ""}{event.location ? ` · ${event.location}` : ""}</p></div>)}</div> : <p className="text-sm text-muted-foreground">Aucun événement enregistré.</p>}
        </CardContent>
      </Card>}

      <Card id="preparation">
        <CardHeader><CardTitle className="text-base">Préparation du véhicule</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {preparation && <p className="text-xs text-muted-foreground">Statut : <strong>{preparation.status === "READY" ? "Prêt" : preparation.status === "BLOCKED" ? "Bloqué" : "En préparation"}</strong></p>}
          {canWrite && c.status !== "CLOSED" && c.status !== "CANCELLED" ? <PreparationForm contractId={c.id} preparation={preparation} /> : <p className="text-sm text-muted-foreground">La préparation est en lecture seule pour ce contrat.</p>}
        </CardContent>
      </Card>

      <Card id="check-out">
        <CardHeader><CardTitle className="text-base">Check-out mobile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {checkout && <p className="text-xs text-muted-foreground">Dernier check-out : {formatDate(checkout.checkout_at)} · {checkout.mileage.toLocaleString("fr-MA")} km · carburant {checkout.fuel_level}/8</p>}
          {canWrite && c.status === "ACTIVE" ? <CheckoutForm contractId={c.id} checkout={checkout} /> : <p className="text-sm text-muted-foreground">Le check-out est disponible lorsque le contrat est actif.</p>}
        </CardContent>
      </Card>

      <Card id="check-in">
        <CardHeader><CardTitle className="text-base">Check-in / retour mobile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {checkin && <p className="text-xs text-muted-foreground">Retour {checkin.status === "FINALIZED" ? "finalisé" : "en revue"} · {formatDate(checkin.actual_return_at)} · {checkin.return_mileage.toLocaleString("fr-MA")} km · carburant {checkin.fuel_level}/8</p>}
          {canWrite && c.status === "ACTIVE" && checkout && checkin?.status !== "FINALIZED" && returnBranchId && canPerformReturnHere && <CheckinForm contractId={c.id} branchId={returnBranchId} branches={canManage ? branches ?? [] : []} showReturnPhotos={checkin?.status === "REVIEW"} />}
          {canWrite && c.status === "ACTIVE" && checkout && checkin?.status !== "FINALIZED" && !canPerformReturnHere && <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Le retour est prévu dans une autre agence. Un responsable peut enregistrer la restitution depuis la vue globale.</p>}
          {canWrite && c.status === "ACTIVE" && !checkout && <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Validez d’abord le check-out pour ouvrir le retour.</p>}
          {checkin?.status === "FINALIZED" && <div className="rounded-md border bg-muted/20 p-3 text-sm">Le retour est enregistré. Vérifiez les charges ci-dessous avant la clôture du contrat.</div>}
          {c.customer.phone && <WhatsAppLink phone={c.customer.whatsapp ?? c.customer.phone} message={lateReturn ? `Bonjour ${c.customer.name}, le retour du véhicule ${c.vehicle.plate} est en retard. Merci de nous contacter.` : `Bonjour ${c.customer.name}, rappel : merci de prévoir la restitution du véhicule ${c.vehicle.plate}.`} />}
            {(c.returnCharges ?? []).length > 0 && <div className="space-y-2">{(c.returnCharges ?? []).map((charge: any) => <div key={charge.id} className="rounded-md border p-2 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span>{charge.reason}</span><strong>{formatCurrency(Number(charge.amount))}</strong></div><p className="text-xs text-muted-foreground">{chargeTypeLabel(charge.charge_type)} · {Number(charge.quantity)} × {formatCurrency(Number(charge.unit_price))} · {chargeSourceLabel(charge.source)}</p>{canWrite && (charge.branch_id ?? c.branch_id) && ["AGENCY_OWNER", "MANAGER"].includes(ctx.membership.roleKey) && <ReturnChargeOverride chargeId={charge.id} branchId={charge.branch_id ?? c.branch_id} amount={Number(charge.amount)} />}</div>)}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Extras</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {canWrite && c.status !== "CLOSED" && c.status !== "CANCELLED" && <ExtraAssignmentForm target="contract" parentId={c.id} extras={(extras ?? []).map((e) => ({ ...e, price: Number(e.price) }))} />}
          {(assignedExtras ?? []).length ? <div className="space-y-2">{(assignedExtras ?? []).map((extra) => <div key={extra.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"><div><p className="font-medium">{extra.name} × {extra.quantity}</p><p className="text-xs text-muted-foreground">{extra.code} · {formatCurrency(Number(extra.total_amount))}</p></div>{canWrite && c.status !== "CLOSED" && c.status !== "CANCELLED" && <RemoveExtraButton target="contract" id={extra.id} />}</div>)}</div> : <p className="text-sm text-muted-foreground">Aucun extra ajouté.</p>}
          <div className="border-t pt-3 text-sm"><span className="text-muted-foreground">Total extras : </span><strong>{formatCurrency(Number(c.extras_total ?? 0))}</strong></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Documents financiers</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {c.invoices.length > 0 ? c.invoices.map((invoice) => (
            <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <div>
                <Link href={`/agency/contracts/${c.id}/invoice/${invoice.id}`} className="font-mono font-medium hover:underline">{invoice.invoice_number}</Link>
                <p className="text-muted-foreground">{formatDate(invoice.issued_at)} · {invoice.kind === "INVOICE" ? "Facture" : invoice.kind}</p>
                <p className="text-xs text-muted-foreground">
                  HT {formatCurrency(Number(invoice.subtotal), invoice.currency)} · TVA {formatCurrency(Number(invoice.tax_amount), invoice.currency)} ({invoice.tax_rate}%)
                </p>
              </div>
              <p className="font-semibold tabular-nums">{formatCurrency(Number(invoice.total_amount), invoice.currency)}</p>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">Aucune facture émise pour ce contrat.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Constats de remise et restitution</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <InspectionSummary title="Remise" inspection={pickupInspection} />
          {canWrite && c.status === "ACTIVE" && !pickupInspection && (
            <InspectionForm contractId={c.id} inspectionType="PICKUP" />
          )}
          <InspectionSummary title="Restitution" inspection={returnInspection} />
          {canWrite && checkin?.status === "FINALIZED" && c.status !== "CANCELLED" && !returnInspection && (
            <InspectionForm contractId={c.id} inspectionType="RETURN" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Photos d&apos;état</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <PhotoGallery title="Remise" photos={pickupPhotos} />
          <PhotoGallery title="Restitution" photos={returnPhotos} />
          <p className="text-xs text-muted-foreground">Les photos se chargent directement dans les parcours « Remettre le véhicule » et « Enregistrer le retour ». Cette section affiche l’historique conservé.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Signatures</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(["CUSTOMER", "EMPLOYEE"] as const).map((type) => { const signature = (signatures ?? []).find((item: any) => item.signer_type === type); const customerWorkflow = type === "CUSTOMER" && c.status === "ACTIVE" && !signature; return <div key={type} className="rounded-lg border p-3"><p className="mb-2 text-sm font-medium">{type === "CUSTOMER" ? "Signature client" : "Signature employé"}</p>{signature ? <><img src={signature.signature_data} alt={`Signature ${type === "CUSTOMER" ? "client" : "employé"}`} className="h-28 w-full rounded border bg-white object-contain" /><p className="mt-2 text-xs text-muted-foreground">{signature.signer_name} · version {signature.contract_version} · {formatDate(signature.signed_at)}</p></> : customerWorkflow ? <p className="text-xs text-muted-foreground">La signature client est demandée directement pendant le check-out et le check-in.</p> : canWrite && ["ACTIVE", "CLOSED"].includes(c.status) ? <SignatureForm contractId={c.id} signerType={type} defaultName={type === "CUSTOMER" ? c.customer.name : ctx.profile.full_name ?? ""} /> : <p className="text-xs text-muted-foreground">Aucune signature.</p>}</div>; })}
          </div>
          <p className="text-xs text-muted-foreground">Les signatures sont conservées dans l’espace privé de votre agence et apparaissent à l’impression du contrat.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base"><Wallet className="size-4" /> Paiements ({c.payments.length})</CardTitle>
          {canRecordPayment && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/agency/payments/new?contract=${c.id}`}><Plus /> Ajouter un paiement</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-0">
          {c.payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(p.paid_at)}</TableCell>
                    <TableCell className="text-sm">{PAYMENT_TYPE[p.type]}</TableCell>
                    <TableCell className="text-sm">{PAYMENT_METHOD[p.method]}</TableCell>
                    <TableCell className="text-sm tabular-nums">{formatCurrency(Number(p.amount))}</TableCell>
                    <TableCell><StatusBadge meta={PAYMENT_STATUS[p.status]} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="px-6 py-4 text-sm text-muted-foreground">Aucun paiement enregistré.</p>
          )}
          {balance > 0 && <div className="mt-3 px-6"><WhatsAppLink phone={c.customer.whatsapp ?? c.customer.phone} message={`Bonjour ${c.customer.name}, il reste ${formatCurrency(balance)} à régler pour le contrat ${c.contract_number}.`} /></div>}
        </CardContent>
      </Card>

      {(c.terms || c.terms_ar) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Conditions du contrat · {c.contract_language === "BILINGUAL" ? "FR / العربية" : c.contract_language}</CardTitle><p className="text-xs text-muted-foreground">Version {c.terms_version} · instantané {formatDate(c.terms_snapshot_at)}</p></CardHeader>
          <CardContent className="space-y-4"><p className="whitespace-pre-wrap text-sm text-muted-foreground">{c.terms}</p>{c.terms_ar && <p dir="rtl" className="whitespace-pre-wrap text-sm text-muted-foreground">{c.terms_ar}</p>}</CardContent>
        </Card>
      )}
    </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}

function InspectionSummary({
  title,
  inspection,
}: {
  title: string;
  inspection?: {
    inspected_at: string;
    mileage: number | null;
    fuel_level: number | null;
    signature_name: string;
    notes: string | null;
    damage_notes: string | null;
  };
}) {
  if (!inspection) return <p className="text-sm text-muted-foreground">{title} : aucun constat enregistré.</p>;
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="font-medium">{title} · signé par {inspection.signature_name}</p>
        <p className="text-muted-foreground">{formatDate(inspection.inspected_at)}</p>
      </div>
      <p className="mt-1 text-muted-foreground">
        {inspection.mileage !== null ? `${inspection.mileage.toLocaleString("fr-MA")} km` : "Km non renseigné"}
        {" · "}
        {inspection.fuel_level !== null ? `carburant ${inspection.fuel_level}/8` : "carburant non renseigné"}
      </p>
      {inspection.notes && <p className="mt-2 whitespace-pre-wrap">{inspection.notes}</p>}
      {inspection.damage_notes && <p className="mt-2 whitespace-pre-wrap text-amber-700 dark:text-amber-300">Dommages : {inspection.damage_notes}</p>}
    </div>
  );
}

function PhotoGallery({
  title,
  photos,
}: {
  title: string;
  photos: Array<{ id: string; file_name: string; signedUrl: string | null; created_at: string }>;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title} ({photos.length})</p>
      {photos.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {photos.map((photo) => photo.signedUrl ? (
            <a key={photo.id} href={photo.signedUrl} target="_blank" rel="noreferrer" className="group w-28 space-y-1">
              <span className="block h-20 rounded-md border bg-cover bg-center bg-muted transition group-hover:ring-2 group-hover:ring-primary" style={{ backgroundImage: `url("${photo.signedUrl}")` }} aria-label={photo.file_name} />
              <span className="block truncate text-[11px] text-muted-foreground">{photo.file_name}</span>
            </a>
          ) : <span key={photo.id} className="text-xs text-muted-foreground">{photo.file_name}</span>)}
        </div>
      ) : <p className="text-xs text-muted-foreground">Aucune photo.</p>}
    </div>
  );
}
