import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Plans — FleetHub Admin" };

function limit(v: number | null) {
  return v === null ? "Unlimited" : String(v);
}

export default async function PlansPage() {
  const supabase = await createClient();
  const { data: plans } = await supabase.from("plans").select("*").order("sort_order");

  return (
    <>
      <PageHeader title="Plans" description="SaaS plans and their limits. Assigned to agencies on creation." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(plans ?? []).map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{p.name}</CardTitle>
                {p.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
              </div>
              <p className="text-2xl font-semibold">
                {formatCurrency(Number(p.price))}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}/ {p.billing_cycle.toLowerCase()}
                </span>
              </p>
              {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Line label="Vehicles" value={limit(p.max_vehicles)} />
              <Line label="Users" value={limit(p.max_users)} />
              <Line label="Branches" value={limit(p.max_branches)} />
              <Line label="Storage" value={p.max_storage_mb ? `${Math.round(p.max_storage_mb / 1024)} GB` : "Unlimited"} />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
