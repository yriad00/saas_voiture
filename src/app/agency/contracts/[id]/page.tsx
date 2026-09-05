import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, CarFront, Calendar, Wallet, Plus } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { getContract } from "@/lib/services/contracts";
import { ContractActions } from "./contract-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CONTRACT_STATUS, PAYMENT_METHOD, PAYMENT_TYPE, PAYMENT_STATUS } from "@/lib/labels";

function fuel(level: number | null) {
  return level === null ? "—" : `${level}/8`;
}

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAgency();
  const { id } = await params;
  const c = await getContract(id);
  if (!c || c.agency_id !== ctx.membership.agencyId) notFound();

  const canWrite = ["AGENCY_OWNER", "MANAGER", "AGENT"].includes(ctx.membership.roleKey);
  const balance = Number(c.total_amount) - c.paidTotal;

  return (
    <div className="space-y-6">
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
        {canWrite && (
          <div className="space-y-2">
            <ContractActions contractId={c.id} status={c.status} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="size-4" /> Client</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Link href={`/agency/customers/${c.customer.id}`} className="font-medium hover:underline">{c.customer.name}</Link>
            {c.customer.phone && <p className="text-muted-foreground">{c.customer.phone}</p>}
            {c.customer.email && <p className="text-muted-foreground">{c.customer.email}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CarFront className="size-4" /> Véhicule</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Link href={`/agency/fleet/${c.vehicle.id}`} className="font-medium hover:underline">{c.vehicle.label}</Link>
            <p className="font-mono text-muted-foreground">{c.vehicle.plate}</p>
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

      <Card>
        <CardHeader><CardTitle className="text-base">Finances</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Info label="Tarif / jour" value={formatCurrency(Number(c.daily_rate))} />
          <Info label="Caution" value={formatCurrency(Number(c.deposit_amount))} />
          <Info label="Total contrat" value={formatCurrency(Number(c.total_amount))} />
          <Info label="Payé" value={formatCurrency(c.paidTotal)} />
          <div className="col-span-2 sm:col-span-4">
            <div className={`rounded-md border p-3 text-sm ${balance > 0 ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" : "border-green-300 bg-green-50 dark:bg-green-950/30"}`}>
              {balance > 0
                ? <>Solde restant à régler : <strong>{formatCurrency(balance)}</strong></>
                : <>Contrat entièrement réglé.</>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base"><Wallet className="size-4" /> Paiements ({c.payments.length})</CardTitle>
          {canWrite && (
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
        </CardContent>
      </Card>

      {c.terms && (
        <Card>
          <CardHeader><CardTitle className="text-base">Conditions du contrat</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{c.terms}</p></CardContent>
        </Card>
      )}
    </div>
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
