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
import { getOpenCustomerRiskFlag } from "@/lib/services/customer-risk";
import { CustomerRiskControl } from "../risk-control";
import { CustomerDocumentForm } from "../document-form";
import { WhatsAppLink } from "@/components/whatsapp-link";

type CustomerDocumentRow = { id: string; document_type: string; file_name: string; content_type: string; size_bytes: number; storage_path: string; expires_at?: string | null; created_at: string };

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
  const riskFlag = await getOpenCustomerRiskFlag(supabase, ctx.membership.agencyId, id);
  const documentsWithExpiry = await supabase
    .from("customer_documents")
    .select("id, document_type, file_name, content_type, size_bytes, storage_path, expires_at, created_at")
    .eq("agency_id", ctx.membership.agencyId)
    .eq("customer_id", id)
    .order("created_at", { ascending: false });
  // Keep the page readable while an older deployment is waiting for 0085.
  // The normal path always uses the expiry-aware projection.
  let documents: CustomerDocumentRow[] = (documentsWithExpiry.data ?? []) as CustomerDocumentRow[];
  if (documentsWithExpiry.error?.code === "42703") {
    const fallbackDocuments = await supabase
      .from("customer_documents")
      .select("id, document_type, file_name, content_type, size_bytes, storage_path, created_at")
      .eq("agency_id", ctx.membership.agencyId)
      .eq("customer_id", id)
      .order("created_at", { ascending: false });
    documents = (fallbackDocuments.data ?? []).map((document) => ({ ...document, expires_at: null }));
  }
  const { data: customerPayments } = await supabase
    .from("payments")
    .select("id, amount, type, status, paid_at, method, contract_id")
    .eq("agency_id", ctx.membership.agencyId)
    .eq("customer_id", id)
    .order("paid_at", { ascending: false })
    .limit(30);
  const documentLinks = await Promise.all((documents ?? []).map(async (document) => {
    const { data } = await supabase.storage.from("customer-documents").createSignedUrl(document.storage_path, 300);
    return { ...document, signedUrl: data?.signedUrl ?? null };
  }));

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
            <div className="mt-2"><WhatsAppLink phone={customer.whatsapp ?? customer.phone} message={`Bonjour ${customer.first_name}, votre agence de location vous contacte.`} /></div>
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
            <Info icon={Phone} label="WhatsApp" value={customer.whatsapp} />
            <Info icon={Mail} label="Email" value={customer.email} />
            <Info icon={MapPin} label="Ville" value={customer.city} />
            <Info label="Nationalité" value={customer.nationality} />
            <Info icon={Calendar} label="Date de naissance" value={formatDate(customer.date_of_birth)} />
            {customer.address && <div className="sm:col-span-2"><Info icon={MapPin} label="Adresse" value={customer.address} /></div>}
          </CardContent>
        </Card>

        <Card>
           <CardHeader><CardTitle className="text-base">Pièce d&apos;identité & permis</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Info icon={CreditCard} label="Type de pièce" value={ID_DOCUMENT_TYPE[customer.id_type]} />
            <Info label="N° de la pièce" value={customer.id_number} />
            <Info label="N° permis" value={customer.driver_license_number} />
            <Info icon={Calendar} label="Expiration permis" value={formatDate(customer.driver_license_expiry)} />
            <Info icon={Calendar} label="Expiration CIN / passeport" value={formatDate(customer.id_expiry ?? customer.passport_expiry)} />
            <Info label="Permis international" value={customer.international_permit_number} />
          </CardContent>
        </Card>
      </div>

      <CustomerRiskControl customerId={customer.id} flag={riskFlag} />

      <Card>
        <CardHeader><CardTitle className="text-base">Documents client</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <CustomerDocumentForm customerId={customer.id} />
          {documentLinks.length > 0 && (
            <div className="divide-y rounded-lg border">
              {documentLinks.map((document) => (
                <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div><p className="font-medium">{document.file_name}</p><p className="text-xs text-muted-foreground">{document.document_type} · {Math.round(Number(document.size_bytes) / 1024)} Ko{document.expires_at ? ` · expire le ${formatDate(document.expires_at)}` : ""}</p></div>
                  {document.signedUrl ? <a className="text-primary hover:underline" href={document.signedUrl} target="_blank" rel="noreferrer">Ouvrir</a> : <span className="text-xs text-muted-foreground">Lien indisponible</span>}
                </div>
              ))}
            </div>
          )}
          {documentLinks.length === 0 && <p className="text-sm text-muted-foreground">Aucun document privé ajouté.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Historique financier</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(() => { const completed = (customerPayments ?? []).filter((p) => p.status === "COMPLETED"); const paid = completed.filter((p) => !["REFUND", "DEPOSIT_REFUND"].includes(p.type)).reduce((sum, p) => sum + Number(p.amount), 0); const refunded = completed.filter((p) => ["REFUND", "DEPOSIT_REFUND"].includes(p.type)).reduce((sum, p) => sum + Number(p.amount), 0); return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Info label="Paiements" value={formatCurrency(paid)} /><Info label="Remboursements" value={formatCurrency(refunded)} /><Info label="Opérations" value={String(customerPayments?.length ?? 0)} /><Info label="Net" value={formatCurrency(paid - refunded)} /></div>; })()}
          {(customerPayments ?? []).length > 0 && <div className="divide-y rounded-lg border">{(customerPayments ?? []).slice(0, 8).map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"><span>{payment.type} · {payment.method} · {formatDate(payment.paid_at)}</span><strong>{formatCurrency(Number(payment.amount))}</strong></div>)}</div>}
          {(customerPayments ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aucune opération financière.</p>}
        </CardContent>
      </Card>

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
