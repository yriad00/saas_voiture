import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Mail, Phone, MapPin, CreditCard, Calendar } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { getCustomer } from "@/lib/services/customers";
import { createClient } from "@/lib/supabase/server";
import { DeleteCustomerButton } from "./delete-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ID_DOCUMENT_TYPE, RESERVATION_STATUS } from "@/lib/labels";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAgency();
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer || customer.agency_id !== ctx.membership.agencyId) notFound();

  const canWrite = ["AGENCY_OWNER", "MANAGER", "AGENT"].includes(ctx.membership.roleKey);

  const supabase = await createClient();
  const { data: reservations } = await supabase
    .from("reservations")
    .select("id, reference, start_date, end_date, total_amount, status, vehicles!inner(brand, model)")
    .eq("customer_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/agency/customers"><ArrowLeft /> Retour aux clients</Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary">
            {customer.first_name.slice(0, 1)}{customer.last_name.slice(0, 1)}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {customer.first_name} {customer.last_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {ID_DOCUMENT_TYPE[customer.id_type]}{customer.id_number ? ` · ${customer.id_number}` : ""}
            </p>
          </div>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/agency/reservations/new?customer=${customer.id}`}><Calendar /> Nouvelle réservation</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/agency/customers/${customer.id}/edit`}><Pencil /> Modifier</Link>
            </Button>
            <DeleteCustomerButton customerId={customer.id} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Coordonnées</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Info icon={Phone} label="Téléphone" value={customer.phone} />
            <Info icon={Mail} label="Email" value={customer.email} />
            <Info icon={MapPin} label="Ville" value={customer.city} />
            <Info label="Nationalité" value={customer.nationality} />
            <Info icon={Calendar} label="Date de naissance" value={formatDate(customer.date_of_birth)} />
            {customer.address && <div className="sm:col-span-2"><Info icon={MapPin} label="Adresse" value={customer.address} /></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Pièce d'identité & permis</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Info icon={CreditCard} label="Type de pièce" value={ID_DOCUMENT_TYPE[customer.id_type]} />
            <Info label="N° de la pièce" value={customer.id_number} />
            <Info label="N° permis" value={customer.driver_license_number} />
            <Info icon={Calendar} label="Expiration permis" value={formatDate(customer.driver_license_expiry)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Historique des réservations</CardTitle></CardHeader>
        <CardContent className="px-0">
          {reservations && reservations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Véhicule</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((r) => {
                  const v = r.vehicles as unknown as { brand: string; model: string };
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link href={`/agency/reservations/${r.id}`} className="font-mono text-sm hover:underline">{r.reference}</Link>
                      </TableCell>
                      <TableCell className="text-sm">{v.brand} {v.model}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(r.start_date)} → {formatDate(r.end_date)}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{formatCurrency(Number(r.total_amount))}</TableCell>
                      <TableCell><StatusBadge meta={RESERVATION_STATUS[r.status]} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="px-6 py-4 text-sm text-muted-foreground">Aucune réservation pour ce client.</p>
          )}
        </CardContent>
      </Card>

      {customer.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap text-sm">{customer.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon?: typeof Mail; label: string; value: string | null }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" />} {label}
      </p>
      <p className="mt-0.5 text-sm">{value ?? "—"}</p>
    </div>
  );
}
