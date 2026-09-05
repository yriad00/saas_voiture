import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, User, CarFront, Calendar, MapPin } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { getReservation } from "@/lib/services/reservations";
import { ReservationStatusActions } from "./status-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RESERVATION_STATUS } from "@/lib/labels";

export default async function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAgency();
  const { id } = await params;
  const r = await getReservation(id);
  if (!r || r.agency_id !== ctx.membership.agencyId) notFound();

  const canWrite = ["AGENCY_OWNER", "MANAGER", "AGENT"].includes(ctx.membership.roleKey);

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
            {!r.hasContract && r.status !== "CANCELLED" && (
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CarFront className="size-4" /> Véhicule</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Link href={`/agency/fleet/${r.vehicle.id}`} className="font-medium hover:underline">{r.vehicle.label}</Link>
            <p className="font-mono text-muted-foreground">{r.vehicle.plate}</p>
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

      <Card>
        <CardHeader><CardTitle className="text-base">Détails financiers</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Info label="Tarif / jour" value={formatCurrency(Number(r.daily_rate))} />
          <Info label="Nombre de jours" value={String(r.total_days)} />
          <Info label="Remise" value={formatCurrency(Number(r.discount))} />
          <Info label="Total" value={formatCurrency(Number(r.total_amount))} />
          {(r.pickup_location || r.return_location) && (
            <>
              <div className="col-span-2"><Info icon={MapPin} label="Prise en charge" value={r.pickup_location} /></div>
              <div className="col-span-2"><Info icon={MapPin} label="Restitution" value={r.return_location} /></div>
            </>
          )}
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
