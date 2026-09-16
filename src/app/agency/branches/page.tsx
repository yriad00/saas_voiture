import { requireAgencyPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BranchForm } from "./branch-form";
import { BranchStatusAction } from "./status-action";

export const metadata = { title: "Branches — FleetHub" };

export default async function BranchesPage() {
  const ctx = await requireAgencyPermission("branches.view");
  const supabase = await createClient();
  const { data: branches } = await supabase.from("branches").select("id, name, code, city, address, phone, whatsapp, email, active, created_at").eq("agency_id", ctx.membership.agencyId).order("name");
  const canManage = ["AGENCY_OWNER", "MANAGER"].includes(ctx.membership.roleKey) && ctx.membership.permissions.includes("branches.create");
  return (
    <div className="space-y-6">
      <PageHeader title="Branches" description="Gérez les agences, points de retrait et équipes de votre société." />
      {canManage && <BranchForm />}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Branche</TableHead><TableHead>Code</TableHead><TableHead>Ville</TableHead><TableHead>Contact</TableHead><TableHead>Statut</TableHead>{canManage && <TableHead />}</TableRow></TableHeader>
            <TableBody>{(branches ?? []).map((branch) => <TableRow key={branch.id}>
              <TableCell><div className="font-medium">{branch.name}</div><div className="text-xs text-muted-foreground">{branch.address ?? "Adresse non renseignée"}</div></TableCell>
              <TableCell className="font-mono text-xs">{branch.code}</TableCell>
              <TableCell>{branch.city ?? "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{branch.phone ?? branch.whatsapp ?? branch.email ?? "—"}</TableCell>
              <TableCell><Badge variant={branch.active ? "success" : "secondary"}>{branch.active ? "Active" : "Inactive"}</Badge></TableCell>
              {canManage && <TableCell><BranchStatusAction id={branch.id} active={branch.active} /></TableCell>}
            </TableRow>)}</TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
