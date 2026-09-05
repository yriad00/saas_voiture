import Link from "next/link";
import { Plus, Wallet, TrendingUp, TrendingDown, Hash } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { listPayments, getPaymentTotals } from "@/lib/services/payments";
import { StatCard, PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSearch } from "@/components/ui/table-search";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_METHOD, PAYMENT_TYPE, PAYMENT_STATUS } from "@/lib/labels";

export const metadata = { title: "Paiements — FleetHub" };

export default async function PaymentsPage() {
  const ctx = await requireAgency();
  const [payments, totals] = await Promise.all([
    listPayments(ctx.membership.agencyId),
    getPaymentTotals(ctx.membership.agencyId),
  ]);

  return (
    <>
      <PageHeader
        title="Paiements"
        description="Encaissements, cautions et remboursements de votre agence."
        action={
          <Button asChild>
            <Link href="/agency/payments/new"><Plus /> Nouveau paiement</Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Encaissé" value={formatCurrency(totals.income)} icon={TrendingUp} accent="text-green-600" />
        <StatCard label="Remboursé" value={formatCurrency(totals.refunds)} icon={TrendingDown} accent="text-red-600" />
        <StatCard label="Net" value={formatCurrency(totals.net)} icon={Wallet} accent="text-primary" />
        <StatCard label="Transactions" value={totals.count} icon={Hash} />
      </div>

      {payments.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Wallet className="size-6" />
          </div>
          <div>
            <p className="font-medium">Aucun paiement</p>
            <p className="text-sm text-muted-foreground">Enregistrez votre premier paiement.</p>
          </div>
          <Button asChild>
            <Link href="/agency/payments/new"><Plus /> Nouveau paiement</Link>
          </Button>
        </Card>
      ) : (
        <div data-searchable className="space-y-3">
          <div className="flex justify-end">
            <TableSearch placeholder="Rechercher un paiement…" />
          </div>
          <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Contrat</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id} data-row>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(p.paid_at)}</TableCell>
                    <TableCell className="text-sm">{p.customerName ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.contractNumber ? (
                        <Link href={`/agency/contracts/${p.contract_id}`} className="hover:underline">{p.contractNumber}</Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{PAYMENT_TYPE[p.type]}</TableCell>
                    <TableCell className="text-sm">{PAYMENT_METHOD[p.method]}</TableCell>
                    <TableCell className={`text-sm tabular-nums ${p.type === "REFUND" ? "text-red-600" : ""}`}>
                      {p.type === "REFUND" ? "−" : ""}{formatCurrency(Number(p.amount))}
                    </TableCell>
                    <TableCell><StatusBadge meta={PAYMENT_STATUS[p.status]} /></TableCell>
                  </TableRow>
                ))}
                <tr data-empty-row hidden>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Aucun paiement ne correspond à votre recherche.
                  </TableCell>
                </tr>
              </TableBody>
            </Table>
          </div>
          </Card>
        </div>
      )}
    </>
  );
}
