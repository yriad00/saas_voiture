import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import { measurePerf } from "@/lib/perf";

export type DashboardAlert = {
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  href: string;
};

export type DashboardData = {
  timezone: string;
  metrics: {
    totalVehicles: number;
    availableVehicles: number;
    rentedVehicles: number;
    reservedVehicles: number;
    maintenanceVehicles: number;
    unavailableVehicles: number;
    reservationsToday: number;
    pickupsToday: number;
    returnsToday: number;
    lateReturns: number;
    activeRentals: number;
    pendingReservations: number;
    unpaidBalances: number;
    depositsHeld: number;
    revenueToday: number;
    revenueWeek: number;
    revenueMonth: number;
    expensesMonth: number;
    netProfitMonth: number;
    utilizationRate: number;
  };
  alerts: DashboardAlert[];
};

type DashboardRpc = {
  timezone?: string;
  metrics?: Partial<Record<keyof DashboardData["metrics"], number>>;
  alerts?: Array<Partial<DashboardAlert>>;
};

const asObject = (value: Json | null): DashboardRpc => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as DashboardRpc;
};

const asSeverity = (value: unknown): DashboardAlert["severity"] =>
  value === "critical" || value === "info" ? value : "warning";

/**
 * Fetches the dashboard read model in a single tenant/branch-safe database
 * round-trip. The RPC is SECURITY INVOKER, so existing RLS policies remain
 * the source of truth for visibility and authorization.
 */
export async function getDashboardData(
  agencyId: string,
  branchId: string | null = null,
  currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date()),
): Promise<DashboardData> {
  const supabase = await createClient();
  const { data, error } = await measurePerf("dashboard.summary", async () => supabase.rpc("get_dashboard_summary", {
    p_agency_id: agencyId,
    p_branch_id: branchId,
    p_current_date: currentDate,
  }));
  if (error) throw error;

  const rpc = asObject(data);
  const rawMetrics = rpc.metrics ?? {};
  const metrics = {
    totalVehicles: Number(rawMetrics.totalVehicles ?? 0),
    availableVehicles: Number(rawMetrics.availableVehicles ?? 0),
    rentedVehicles: Number(rawMetrics.rentedVehicles ?? 0),
    reservedVehicles: Number(rawMetrics.reservedVehicles ?? 0),
    maintenanceVehicles: Number(rawMetrics.maintenanceVehicles ?? 0),
    unavailableVehicles: Number(rawMetrics.unavailableVehicles ?? 0),
    reservationsToday: Number(rawMetrics.reservationsToday ?? 0),
    pickupsToday: Number(rawMetrics.pickupsToday ?? 0),
    returnsToday: Number(rawMetrics.returnsToday ?? 0),
    lateReturns: Number(rawMetrics.lateReturns ?? 0),
    activeRentals: Number(rawMetrics.activeRentals ?? 0),
    pendingReservations: Number(rawMetrics.pendingReservations ?? 0),
    unpaidBalances: Number(rawMetrics.unpaidBalances ?? 0),
    depositsHeld: Number(rawMetrics.depositsHeld ?? 0),
    revenueToday: Number(rawMetrics.revenueToday ?? 0),
    revenueWeek: Number(rawMetrics.revenueWeek ?? 0),
    revenueMonth: Number(rawMetrics.revenueMonth ?? 0),
    expensesMonth: Number(rawMetrics.expensesMonth ?? 0),
    netProfitMonth: Number(rawMetrics.netProfitMonth ?? 0),
    utilizationRate: Number(rawMetrics.utilizationRate ?? 0),
  };

  const alerts = (Array.isArray(rpc.alerts) ? rpc.alerts : [])
    .filter((alert): alert is Partial<DashboardAlert> => Boolean(alert && typeof alert === "object"))
    .map((alert) => ({
      severity: asSeverity(alert.severity),
      title: String(alert.title ?? "Alerte"),
      description: String(alert.description ?? ""),
      href: String(alert.href ?? "/agency/today"),
    }));

  return {
    timezone: rpc.timezone || "Africa/Casablanca",
    metrics,
    alerts,
  };
}
