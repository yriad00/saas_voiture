import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { listAgencies } from "@/lib/services/agencies";
import { PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AgencyStatusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Agencies — FleetHub Admin" };

export default async function AgenciesPage() {
  const agencies = await listAgencies();

  return (
    <>
      <PageHeader
        title="Agencies"
        description="Every tenant on the platform. Only you can create or change an agency."
        action={
          <Button asChild>
            <Link href="/super-admin/agencies/new">
              <Plus /> New agency
            </Link>
          </Button>
        }
      />

      {agencies.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Building2 className="size-6" />
          </div>
          <div>
            <p className="font-medium">No agencies yet</p>
            <p className="text-sm text-muted-foreground">Create the first agency to get started.</p>
          </div>
          <Button asChild>
            <Link href="/super-admin/agencies/new">
              <Plus /> New agency
            </Link>
          </Button>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agencies.map((a) => (
                <TableRow key={a.id} className="cursor-default">
                  <TableCell>
                    <Link
                      href={`/super-admin/agencies/${a.id}`}
                      className="flex items-center gap-3 font-medium hover:underline"
                    >
                      <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                        {a.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{a.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">/{a.slug}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="block text-sm">{a.ownerName ?? "—"}</span>
                    <span className="block text-xs text-muted-foreground">{a.ownerEmail ?? ""}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.city ?? "—"}</TableCell>
                  <TableCell className="text-sm">{a.planName ?? "—"}</TableCell>
                  <TableCell className="text-sm tabular-nums">{a.memberCount}</TableCell>
                  <TableCell>
                    <AgencyStatusBadge status={a.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(a.created_at)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(a.endsAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
