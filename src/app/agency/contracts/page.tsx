import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { listContracts, getContractStats } from "@/lib/services/contracts";
import { StatCard, PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSearch } from "@/components/ui/table-search";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CONTRACT_STATUS } from "@/lib/labels";

export const metadata = { title: "Contrats — FleetHub" };

export default async function ContractsPage() {
  const ctx = await requireAgency();
  const [contracts, stats] = await Promise.all([
    listContracts(ctx.membership.agencyId),
    getContractStats(ctx.membership.agencyId),
  ]);

  return (
    <>
      <PageHeader
        title="Contrats"
        description="Les contrats de location de votre agence."
        action={
          <Button asChild>
            <Link href="/agency/contracts/new"><Plus /> Nouveau contrat</Link>
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={FileText} />
        <StatCard label="Actifs" value={stats.byStatus.ACTIVE} icon={FileText} accent="text-green-600" />
        <StatCard label="Clôturés" value={stats.byStatus.CLOSED} icon={FileText} accent="text-primary" />
        <StatCard label="Brouillons" value={stats.byStatus.DRAFT} icon={FileText} accent="text-muted-foreground" />
      </div>

      {contracts.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileText className="size-6" />
          </div>
          <div>
            <p className="font-medium">Aucun contrat</p>
            <p className="text-sm text-muted-foreground">Créez un contrat directement ou depuis une réservation.</p>
          </div>
          <Button asChild>
            <Link href="/agency/contracts/new"><Plus /> Nouveau contrat</Link>
          </Button>
        </Card>
      ) : (
        <div data-searchable className="space-y-3">
          <div className="flex justify-end">
            <TableSearch placeholder="Rechercher (n°, client, véhicule)…" />
          </div>
          <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° contrat</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Véhicule</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => (
                  <TableRow key={c.id} data-row>
                    <TableCell>
                      <Link href={`/agency/contracts/${c.id}`} className="font-mono text-sm font-medium hover:underline">
                        {c.contract_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{c.customerName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.vehicleLabel}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(c.start_date)} → {formatDate(c.end_date)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{formatCurrency(Number(c.total_amount))}</TableCell>
                    <TableCell><StatusBadge meta={CONTRACT_STATUS[c.status]} /></TableCell>
                  </TableRow>
                ))}
                <tr data-empty-row hidden>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Aucun contrat ne correspond à votre recherche.
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
