import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Subscriptions — FleetHub Admin" };

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id, status, amount, started_at, ends_at, agencies!inner(name, currency), plans!inner(name)")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Subscriptions" description="Every agency subscription across the platform." />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agency</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Ends</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(subs ?? []).map((s) => {
              const agency = s.agencies as unknown as { name: string; currency: string };
              const plan = s.plans as unknown as { name: string };
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{agency.name}</TableCell>
                  <TableCell>{plan.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{s.status}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatCurrency(Number(s.amount), agency.currency)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(s.started_at)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(s.ends_at)}</TableCell>
                </TableRow>
              );
            })}
            {(!subs || subs.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No subscriptions yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
