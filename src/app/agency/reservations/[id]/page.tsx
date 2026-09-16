/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, User, CarFront, Calendar, MapPin } from "lucide-react";
import { can, requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReservation } from "@/lib/services/reservations";
import { listActiveExtras, getReservationExtras } from "@/lib/services/extras";
import { ExtraAssignmentForm } from "@/app/agency/extras/assignment-form";
import { RemoveExtraButton } from "@/app/agency/extras/remove-button";
import { ReservationStatusActions } from "./status-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RESERVATION_STATUS } from "@/lib/labels";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { AssignVehicleForm } from "./assign-vehicle-form";

export default async function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAgency();
  const { id } = await params;
  const r = await getReservation(id, ctx.membership.agencyId);
  if (!r) notFound();
  const supabase = await createClient();
  const [{ data: extras }, { data: assignedExtras }] = await Promise.all([
    listActiveExtras(supabase, ctx.membership.agencyId, r.branch_id),
    getReservationExtras(supabase, id, ctx.membership.agencyId),
  ]);
  const { data: assignableVehicles } = r.vehicle ? { data: [] as Array<{ id: string; brand: string; model: string; license_plate: string }> } : await (supabase as any)
    .from("vehicles")
    .select("id,brand,model,license_plate")
    .eq("agency_id", ctx.membership.agencyId)
    .eq("status", "AVAILABLE")
    .is("deleted_at", null)
    .order("brand");

  const canWrite = ["AGENCY_OWNER", "MANAGER", "AGENT"].includes(ctx.membership.roleKey);
  const canFinance = can(ctx, "payments.create");

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/agency/reservations"><ArrowLeft /> Retour aux réservations</Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{r.reference}</h1>
            <StatusBadge meta={RESERVATION_STATUS[r.status]} />
          </div>
          <p className="text-sm text-muted-foreground">{r.total_days} jour(s) · {formatCurrency(Number(r.total_amount))}</p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <ReservationStatusActions reservationId={r.id} current={r.status} />
            {!r.hasContract && r.vehicle && r.status !== "CANCELLED" && r.status !== "NO_SHOW" && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/agency/contracts/new?reservation=${r.id}`}><FileText /> Générer un contrat</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="size-4" /> Client</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Link href={`/agency/customers/${r.customer.id}`} className="font-medium hover:underline">{r.customer.name}</Link>
            {r.customer.phone && <p className="text-muted-foreground">{r.customer.phone}</p>}
            {r.customer.email && <p className="text-muted-foreground">{r.customer.email}</p>}
            <WhatsAppLink phone={(r.customer as any).whatsapp ?? r.customer.phone} message={`Bonjour ${r.customer.name}, confirmation de votre réservation ${r.reference}.`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CarFront className="size-4" /> Véhicule</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {r.vehicle ? <><Link href={`/agency/fleet/${r.vehicle.id}`} className="font-medium hover:underline">{r.vehicle.label}</Link><p className="font-mono text-muted-foreground">{r.vehicle.plate}</p></> : <><p className="font-medium">Catégorie : {(r as any).vehicle_category ?? "à attribuer"}</p><p className="text-xs text-amber-700">Aucun véhicule attribué</p></>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calendar className="size-4" /> Période</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Du <strong>{formatDate(r.start_date)}</strong></p>
            <p>Au <strong>{formatDate(r.end_date)}</strong></p>
          </CardContent>
        </Card>
      </div>

      {!r.vehicle && canWrite && r.status !== "CANCELLED" && r.status !== "NO_SHOW" && <Card><CardHeader><CardTitle className="text-base">Attribuer le véhicule au dernier moment</CardTitle></CardHeader><CardContent><AssignVehicleForm reservationId={r.id} vehicles={assignableVehicles ?? []} /></CardContent></Card>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle className="text-base">Détails financiers</CardTitle>{canFinance && r.status !== "CANCELLED" && r.status !== "NO_SHOW" && <Button asChild size="sm" variant="outline"><Link href={`/agency/payments/new?reservation=${r.id}`}>Enregistrer une avance</Link></Button>}</CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Info label="Tarif / jour" value={formatCurrency(Number(r.daily_rate))} />
          <Info label="Nombre de jours" value={String(r.total_days)} />
          <Info label="Remise" value={formatCurrency(Number(r.discount))} />
          <Info label="Total" value={formatCurrency(Number(r.total_amount))} />
          <Info label="Avance prévue" value={formatCurrency(Number(r.advance_amount ?? 0))} />
          <Info label="Solde restant" value={formatCurrency(Number(r.remaining_amount ?? r.total_amount))} />
          <Info label="Caution prévue" value={formatCurrency(Number(r.deposit_amount ?? 0))} />
          <Info label="Source" value={r.source ?? "OTHER"} />
          {(r.pickup_location || r.return_location) && (
            <>
              <div className="col-span-2"><Info icon={MapPin} label="Prise en charge" value={r.pickup_location} /></div>
              <div className="col-span-2"><Info icon={MapPin} label="Restitution" value={r.return_location} /></div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Extras</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {canWrite && r.status !== "CANCELLED" && r.status !== "COMPLETED" && <ExtraAssignmentForm target="reservation" parentId={r.id} extras={(extras ?? []).map((e) => ({ ...e, price: Number(e.price) }))} />}
          {(assignedExtras ?? []).length ? <div className="space-y-2">{(assignedExtras ?? []).map((extra) => <div key={extra.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"><div><p className="font-medium">{extra.name} × {extra.quantity}</p><p className="text-xs text-muted-foreground">{extra.code} · {formatCurrency(Number(extra.total_amount))}</p></div>{canWrite && r.status !== "COMPLETED" && r.status !== "CANCELLED" && <RemoveExtraButton target="reservation" id={extra.id} />}</div>)}</div> : <p className="text-sm text-muted-foreground">Aucun extra ajouté.</p>}
          <div className="border-t pt-3 text-sm"><span className="text-muted-foreground">Total extras : </span><strong>{formatCurrency(Number(r.extras_total ?? 0))}</strong></div>
        </CardContent>
      </Card>

      {r.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap text-sm">{r.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon?: typeof MapPin; label: string; value: string | null }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" />} {label}
      </p>
      <p className="mt-0.5 text-sm">{value ?? "—"}</p>
    </div>
  );
}
