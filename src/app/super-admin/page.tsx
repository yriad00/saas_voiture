import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Clock,
  PauseCircle,
  Users,
  DollarSign,
  Plus,
} from "lucide-react";
import { getPlatformStats } from "@/lib/services/platform";
import { StatCard, PageHeader } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Dashboard — FleetHub Admin" };

export default async function SuperAdminDashboard() {
  const stats = await getPlatformStats();

  return (
    <>
      <PageHeader
        title="Platform Overview"
        description="Health of every agency on FleetHub at a glance."
        action={
          <Button asChild>
            <Link href="/super-admin/agencies/new">
              <Plus /> New agency
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total agencies" value={stats.totalAgencies} icon={Building2} />
        <StatCard
          label="Active"
          value={stats.byStatus.ACTIVE}
          icon={CheckCircle2}
          accent="text-green-600"
        />
        <StatCard
          label="On trial"
          value={stats.byStatus.TRIAL}
          icon={Clock}
          accent="text-primary"
        />
        <StatCard
          label="Suspended / inactive"
          value={stats.byStatus.SUSPENDED + stats.byStatus.INACTIVE}
          icon={PauseCircle}
          accent="text-amber-600"
        />
        <StatCard label="Staff accounts" value={stats.totalStaff} icon={Users} />
        <StatCard
          label="MRR (active plans)"
          value={formatCurrency(stats.mrr)}
          icon={DollarSign}
          accent="text-green-600"
          hint={`${stats.activeSubscriptions} active subscription(s)`}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Agencies by status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {(
              [
                ["ACTIVE", "Active", "bg-green-500"],
                ["TRIAL", "Trial", "bg-indigo-500"],
                ["INACTIVE", "Inactive", "bg-slate-400"],
                ["SUSPENDED", "Suspended", "bg-amber-500"],
                ["EXPIRED", "Expired", "bg-red-500"],
              ] as const
            ).map(([key, label, color]) => (
              <div key={key} className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${color}`} />
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                </div>
                <p className="mt-2 text-xl font-semibold">{stats.byStatus[key]}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
