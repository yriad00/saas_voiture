import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/stat-card";
import { AddMember } from "./add-member";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Équipe — FleetHub" };

export default async function TeamPage() {
  const ctx = await requireAgency();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("agency_members")
    .select("id, status, profiles!inner(full_name, email, phone), roles!inner(name, key)")
    .eq("agency_id", ctx.membership.agencyId)
    .order("created_at", { ascending: true });

  const canManage = ["AGENCY_OWNER", "MANAGER"].includes(ctx.membership.roleKey);

  return (
    <>
      <PageHeader
        title="Équipe"
        description="Les personnes ayant accès à cette agence et leurs rôles."
        action={canManage ? <AddMember /> : undefined}
      />

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(members ?? []).map((m) => {
                const p = m.profiles as unknown as { full_name: string | null; email: string | null; phone: string | null };
                const r = m.roles as unknown as { name: string };
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                    <TableCell className="text-muted-foreground">{p.phone ?? "—"}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>
                      <Badge variant={m.status === "active" ? "success" : "secondary"}>
                        {m.status === "active" ? "Actif" : m.status === "invited" ? "Invité" : "Désactivé"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}
