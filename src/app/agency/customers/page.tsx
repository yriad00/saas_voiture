import Link from "next/link";
import { Plus, Contact } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { listCustomers } from "@/lib/services/customers";
import { PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSearch } from "@/components/ui/table-search";
import { formatDate } from "@/lib/utils";
import { ID_DOCUMENT_TYPE } from "@/lib/labels";

export const metadata = { title: "Clients — FleetHub" };

export default async function CustomersPage() {
  const ctx = await requireAgency();
  const customers = await listCustomers(ctx.membership.agencyId);

  return (
    <>
      <PageHeader
        title="Clients"
        description="Votre base de clients — coordonnées, pièces d'identité et permis."
        action={
          <Button asChild>
            <Link href="/agency/customers/new"><Plus /> Ajouter un client</Link>
          </Button>
        }
      />

      {customers.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Contact className="size-6" />
          </div>
          <div>
            <p className="font-medium">Aucun client</p>
            <p className="text-sm text-muted-foreground">Ajoutez votre premier client pour commencer.</p>
          </div>
          <Button asChild>
            <Link href="/agency/customers/new"><Plus /> Ajouter un client</Link>
          </Button>
        </Card>
      ) : (
        <div data-searchable className="space-y-3">
          <div className="flex justify-end">
            <TableSearch placeholder="Rechercher un client…" />
          </div>
          <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Pièce</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Ajouté le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id} data-row>
                    <TableCell>
                      <Link href={`/agency/customers/${c.id}`} className="flex items-center gap-3 font-medium hover:underline">
                        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {c.first_name.slice(0, 1)}{c.last_name.slice(0, 1)}
                        </span>
                        {c.first_name} {c.last_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {ID_DOCUMENT_TYPE[c.id_type]}{c.id_number ? ` · ${c.id_number}` : ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.city ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                  </TableRow>
                ))}
                <tr data-empty-row hidden>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Aucun client ne correspond à votre recherche.
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
