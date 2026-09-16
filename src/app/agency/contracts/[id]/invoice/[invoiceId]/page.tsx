/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintButton } from "@/components/ui/print-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { VoidInvoiceButton } from "../../../void-invoice-button";

export const metadata = { title: "Facture — FleetHub" };

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string; invoiceId: string }>;
}) {
  const ctx = await requireAgency();
  const { id, invoiceId } = await params;
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("contract_id", id)
    .eq("agency_id", ctx.membership.agencyId)
    .maybeSingle();
  if (!invoice) notFound();
  const [{ data: agency }, { data: contract }, { data: payments }] = await Promise.all([
    supabase.from("agencies").select("logo_url,name,address,city,phone,email,currency").eq("id", ctx.membership.agencyId).maybeSingle(),
    invoice.contract_id ? supabase.from("contracts").select("contract_number,start_date,end_date,reservations(reference)").eq("id", invoice.contract_id).eq("agency_id", ctx.membership.agencyId).maybeSingle() : Promise.resolve({ data: null }),
    invoice.contract_id ? supabase.from("payments").select("amount,method,type,status,paid_at,reference").eq("contract_id", invoice.contract_id).eq("agency_id", ctx.membership.agencyId).eq("status", "COMPLETED").order("paid_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const documentLabel = invoice.kind === "QUOTE" ? "Devis" : invoice.kind === "RECEIPT" ? "Reçu" : invoice.kind === "CREDIT_NOTE" ? "Avoir" : "Facture";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm"><Link href={`/agency/contracts/${id}`}><ArrowLeft /> Retour au contrat</Link></Button>
        <div className="flex items-center gap-2">
          {invoice.status === "ISSUED" && <VoidInvoiceButton invoiceId={invoice.id} />}
          <PrintButton label="Imprimer / PDF" />
        </div>
      </div>
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0 border-b">
          <div className="flex items-center gap-3">
            {agency?.logo_url && <img src={agency.logo_url} alt="Logo agence" className="h-12 w-12 rounded object-contain" />}
            <div><p className="text-sm font-medium text-muted-foreground">{documentLabel}</p>
            <CardTitle className="mt-1 font-mono text-2xl">{invoice.invoice_number}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Émise le {formatDate(invoice.issued_at)} · {invoice.status === "VOID" ? "Annulée" : "Émise"}</p>
            <p className="text-xs text-muted-foreground">Contrat : {contract?.contract_number ?? "—"}{invoice.snapshot && typeof invoice.snapshot === "object" && "reservation_reference" in invoice.snapshot ? ` · Réservation : ${String((invoice.snapshot as Record<string, unknown>).reservation_reference)}` : ""}</p>
            </div></div>
          <Printer className="size-6 text-primary print:hidden" />
        </CardHeader>
        <CardContent className="space-y-8 p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Party title="Vendeur" name={invoice.seller_name} address={invoice.seller_address} identifiers={[invoice.seller_if ? `IF : ${invoice.seller_if}` : null, invoice.seller_tp ? `TP : ${invoice.seller_tp}` : null, invoice.seller_ice ? `ICE : ${invoice.seller_ice}` : null, invoice.seller_rc ? `RC : ${invoice.seller_rc}` : null]} />
            <Party title="Client" name={invoice.buyer_name} address={invoice.buyer_address} identifiers={invoice.buyer_ice ? [`ICE : ${invoice.buyer_ice}`] : []} />
          </div>
          <div className="rounded-md border">
            <div className="grid grid-cols-[1fr_auto] gap-4 border-b px-4 py-3 text-sm font-medium"><span>Prestation</span><span>Montant</span></div>
            <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-4 text-sm"><span>Location de véhicule — contrat lié</span><span className="tabular-nums">{formatCurrency(Number(invoice.subtotal), invoice.currency)}</span></div>
          </div>
          <div className="grid grid-cols-1 gap-4 rounded-md border p-4 text-sm sm:grid-cols-2">
            <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Période</p><p>{contract ? `${formatDate(contract.start_date)} → ${formatDate(contract.end_date)}` : "—"}</p></div>
            <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Paiements enregistrés</p>{(payments ?? []).length ? <ul className="space-y-1">{(payments ?? []).slice(0, 6).map((payment: any) => <li key={`${payment.paid_at}-${payment.amount}`} className="flex justify-between gap-3"><span>{payment.type} · {payment.method}</span><span className="tabular-nums">{formatCurrency(Number(payment.amount), invoice.currency)}</span></li>)}</ul> : <p className="text-muted-foreground">Aucun paiement lié.</p>}</div>
          </div>
          <div className="ml-auto max-w-xs space-y-2 text-sm">
            <Total label="Total HT" value={formatCurrency(Number(invoice.subtotal), invoice.currency)} />
            <Total label={`TVA (${invoice.tax_rate}%)`} value={formatCurrency(Number(invoice.tax_amount), invoice.currency)} />
            <Total label="Total TTC" value={formatCurrency(Number(invoice.total_amount), invoice.currency)} strong />
          </div>
          {invoice.notes && <p className="whitespace-pre-wrap border-t pt-4 text-sm text-muted-foreground">{invoice.notes}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Party({ title, name, address, identifiers }: { title: string; name: string; address: string | null; identifiers: Array<string | null> }) {
  return <div className="space-y-1 text-sm"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p><p className="font-semibold">{name}</p>{address && <p className="whitespace-pre-wrap text-muted-foreground">{address}</p>}{identifiers.filter(Boolean).map((value, index) => <p key={`${title}-${index}`} className="font-mono text-xs text-muted-foreground">{value}</p>)}</div>;
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between gap-4 ${strong ? "border-t pt-2 text-base font-semibold" : "text-muted-foreground"}`}><span>{label}</span><span className="tabular-nums">{value}</span></div>;
}
