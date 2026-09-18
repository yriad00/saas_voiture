import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import { measurePerf } from "@/lib/perf";

type TodayOverviewRpc = {
  metrics?: {
    pickups_today?: number;
    returns_today?: number;
    late_returns?: number;
    unpaid_balances?: number;
    deposits_held?: number;
    document_alerts?: number;
  };
  departures?: TodayDeparture[];
  returns?: TodayReturn[];
  preparations?: TodayPreparation[];
  missions?: TodayMission[];
  deposits?: TodayDeposit[];
  alerts?: TodayAlert[];
};

export type TodayDeparture = {
  id: string;
  reference: string;
  customer_id: string;
  customer_name: string;
  vehicle_id: string | null;
  vehicle_name: string | null;
  start_date: string;
  end_date: string;
};

export type TodayReturn = {
  id: string;
  contract_number: string;
  customer_id: string;
  customer_name: string;
  vehicle_id: string;
  vehicle_name: string;
  end_date: string;
};

export type TodayPreparation = {
  id: string;
  contract_id: string | null;
  contract_number: string | null;
  status: string;
};

export type TodayMission = {
  id: string;
  mission_type: string;
  address: string | null;
  scheduled_at: string;
  status: string;
  vehicle_id: string | null;
  vehicle_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
};

export type TodayDeposit = {
  id: string;
  contract_id: string | null;
  contract_number: string | null;
  status: string;
  held_amount: number;
};

export type TodayAlert = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  tone?: "warning";
};

export type TodayOverview = {
  metrics: {
    pickupsToday: number;
    returnsToday: number;
    lateReturns: number;
    unpaidBalances: number;
    depositsHeld: number;
    documentAlerts: number;
  };
  departures: TodayDeparture[];
  returns: TodayReturn[];
  preparations: TodayPreparation[];
  missions: TodayMission[];
  deposits: TodayDeposit[];
  alerts: TodayAlert[];
};

const asObject = (value: Json | null): TodayOverviewRpc => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as TodayOverviewRpc;
};

/**
 * Fetch only the command-centre read model. The function is SECURITY INVOKER,
 * so the caller's existing tenant/branch RLS policies still apply.
 */
export async function getTodayOverview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  agencyId: string,
  branchId: string | null,
  currentDate: string,
): Promise<TodayOverview> {
  const { data, error } = await measurePerf("today.overview", async () => supabase.rpc("get_today_overview", {
    p_agency_id: agencyId,
    p_branch_id: branchId,
    p_current_date: currentDate,
  }));
  if (error) throw error;

  const rpc = asObject(data);
  const metrics = rpc.metrics ?? {};
  return {
    metrics: {
      pickupsToday: Number(metrics.pickups_today ?? 0),
      returnsToday: Number(metrics.returns_today ?? 0),
      lateReturns: Number(metrics.late_returns ?? 0),
      unpaidBalances: Number(metrics.unpaid_balances ?? 0),
      depositsHeld: Number(metrics.deposits_held ?? 0),
      documentAlerts: Number(metrics.document_alerts ?? 0),
    },
    departures: Array.isArray(rpc.departures) ? rpc.departures : [],
    returns: Array.isArray(rpc.returns) ? rpc.returns : [],
    preparations: Array.isArray(rpc.preparations) ? rpc.preparations : [],
    missions: Array.isArray(rpc.missions) ? rpc.missions : [],
    deposits: Array.isArray(rpc.deposits) ? rpc.deposits : [],
    alerts: Array.isArray(rpc.alerts) ? rpc.alerts : [],
  };
}
