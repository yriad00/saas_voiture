import Link from "next/link";
import { AlertTriangle, CalendarCheck, CarFront, CircleAlert, Clock3, CreditCard, FileWarning, Gauge, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/layout/stat-card";
import { formatCurrency } from "@/lib/utils";
import type { DashboardData } from "@/lib/services/dashboard";

export function DashboardOperations({ data }: { data: DashboardData }) {
  const { metrics, alerts } = data;
  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Réservées" value={metrics.reservedVehicles} icon={CalendarCheck} accent="text-primary" />
        <StatCard label="Maintenance" value={metrics.maintenanceVehicles} icon={Wrench} accent="text-amber-600" />
        <StatCard label="Indisponibles" value={metrics.unavailableVehicles} icon={CarFront} accent="text-destructive" />
        <StatCard label="Retours en retard" value={metrics.lateReturns} icon={Clock3} accent="text-destructive" />
        <StatCard label="À prendre aujourd’hui" value={metrics.pickupsToday} icon={CalendarCheck} accent="text-green-600" />
        <StatCard label="À rendre aujourd’hui" value={metrics.returnsToday} icon={CalendarCheck} accent="text-amber-600" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="En attente" value={metrics.pendingReservations} icon={Clock3} />
        <StatCard label="Solde impayé" value={formatCurrency(metrics.unpaidBalances)} icon={CreditCard} accent="text-destructive" />
        <StatCard label="Cautions détenues" value={formatCurrency(metrics.depositsHeld)} icon={CreditCard} accent="text-amber-600" />
        <StatCard label="Utilisation flotte" value={`${metrics.utilizationRate}%`} icon={Gauge} accent="text-primary" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Pilotage financier</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FinanceItem label="Revenus aujourd’hui" value={metrics.revenueToday} />
            <FinanceItem label="Revenus cette semaine" value={metrics.revenueWeek} />
            <FinanceItem label="Revenus ce mois" value={metrics.revenueMonth} />
            <FinanceItem label="Charges ce mois" value={metrics.expensesMonth} negative />
            <FinanceItem label="Résultat estimé" value={metrics.netProfitMonth} negative={metrics.netProfitMonth < 0} />
            <FinanceItem label="Locations actives" value={metrics.activeRentals} currency={false} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0"><AlertTriangle className="size-4 text-amber-600" /><CardTitle className="text-base">Alertes importantes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune alerte critique ou urgente.</p>
            ) : alerts.map((alert) => (
              <Link key={`${alert.title}-${alert.description}`} href={alert.href} className="block rounded-md border p-3 transition-colors hover:bg-muted/50">
                <p className="flex items-center gap-2 text-sm font-medium"><AlertIcon severity={alert.severity} />{alert.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{alert.description}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center gap-2 space-y-0"><CalendarCheck className="size-4 text-primary" /><CardTitle className="text-base">Opérations du jour</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <Operation label="Réservations actives aujourd’hui" value={metrics.reservationsToday} href="/agency/reservations" />
          <Operation label="Prises en charge" value={metrics.pickupsToday} href="/agency/reservations" />
          <Operation label="Restitutions" value={metrics.returnsToday} href="/agency/reservations" />
        </CardContent>
      </Card>
    </>
  );
}

function FinanceItem({ label, value, negative = false, currency = true }: { label: string; value: number; negative?: boolean; currency?: boolean }) {
  return <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-lg font-semibold tabular-nums ${negative ? "text-amber-700 dark:text-amber-300" : ""}`}>{currency ? formatCurrency(value) : value}</p></div>;
}

function Operation({ label, value, href }: { label: string; value: number; href: string }) {
  return <Link href={href} className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted/50"><span>{label}</span><span className="font-semibold tabular-nums">{value}</span></Link>;
}

function AlertIcon({ severity }: { severity: DashboardData["alerts"][number]["severity"] }) {
  if (severity === "critical") return <CircleAlert className="size-4 text-destructive" />;
  if (severity === "warning") return <FileWarning className="size-4 text-amber-600" />;
  return <AlertTriangle className="size-4 text-primary" />;
}
