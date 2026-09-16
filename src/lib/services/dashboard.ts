import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@/lib/supabase/server";
import { computeFleetStats } from "@/lib/services/vehicles";

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

function localDate(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(value);
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return date.toISOString().slice(0, 10);
}

export async function getDashboardData(agencyId: string): Promise<DashboardData> {
  const supabase = await createClient();
  const [{ data: agency }, reservationsResult, contractsResult, paymentsResult, depositsResult, maintenanceResult, expensesResult, vehiclesResult, customersResult] = await Promise.all([
    supabase.from("agencies").select("timezone").eq("id", agencyId).maybeSingle(),
    supabase.from("reservations").select("id, reference, start_date, end_date, status, total_amount, vehicle_id").eq("agency_id", agencyId),
    supabase.from("contracts").select("id, reservation_id, total_amount, base_total_amount, extras_total, return_charges_total, final_total_amount, deposit_amount, start_date, end_date, status, vehicle_id").eq("agency_id", agencyId),
    supabase.from("payments").select("amount, type, status, paid_at, contract_id, reservation_id").eq("agency_id", agencyId),
    (supabase as any).from("deposits").select("held_amount,deducted_amount,refunded_amount").eq("agency_id", agencyId),
    supabase.from("maintenance_records").select("status, next_service_date, service_date, cost, vehicle_id").eq("agency_id", agencyId),
    supabase.from("expenses").select("amount, expense_date").eq("agency_id", agencyId),
    supabase.from("vehicles").select("id, brand, model, license_plate, status, insurance_expiry, technical_inspection_expiry").eq("agency_id", agencyId).is("deleted_at", null),
    supabase.from("customers").select("id,first_name,last_name,id_expiry,driver_license_expiry,passport_expiry").eq("agency_id", agencyId).is("deleted_at", null),
  ]);

  if (reservationsResult.error) throw reservationsResult.error;
  if (contractsResult.error) throw contractsResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  if (depositsResult.error) throw depositsResult.error;
  if (maintenanceResult.error) throw maintenanceResult.error;

  const timezone = agency?.timezone || "Africa/Casablanca";
  const today = localDate(new Date(), timezone);
  const weekStart = startOfWeek(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const reservations = reservationsResult.data ?? [];
  const contracts = contractsResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const maintenance = maintenanceResult.data ?? [];
  const vehicles = vehiclesResult.data ?? [];
  const customers = customersResult.data ?? [];
  const fleet = computeFleetStats(vehicles);

  const activeReservations = reservations.filter((item) => ["CONFIRMED", "ONGOING"].includes(item.status));
  const reservationsToday = activeReservations.filter((item) => item.start_date <= today && item.end_date >= today);
  const pickupsToday = activeReservations.filter((item) => item.start_date === today);
  const returnsToday = activeReservations.filter((item) => item.end_date === today);
  const lateReturns = activeReservations.filter((item) => item.end_date < today);
  const pendingReservations = reservations.filter((item) => item.status === "PENDING");
  const activeContracts = contracts.filter((item) => item.status === "ACTIVE");

  const paymentsByContract = new Map<string, number>();
  const paymentsByReservation = new Map<string, number>();
  const depositsHeld = (depositsResult.data ?? []).reduce((sum: number, deposit: any) => sum + Math.max(0, Number(deposit.held_amount) - Number(deposit.deducted_amount) - Number(deposit.refunded_amount)), 0);
  let revenueToday = 0;
  let revenueWeek = 0;
  let revenueMonth = 0;

  for (const payment of payments) {
    if (payment.status !== "COMPLETED") continue;
    const amount = Number(payment.amount);
    const localPaidDate = localDate(new Date(payment.paid_at), timezone);
    const isDeposit = payment.type === "DEPOSIT" || payment.type === "DEPOSIT_REFUND";
    const signedAmount = payment.type === "REFUND" || payment.type === "DEPOSIT_REFUND" ? -amount : amount;

    if (!isDeposit) {
      if (payment.contract_id) paymentsByContract.set(payment.contract_id, (paymentsByContract.get(payment.contract_id) ?? 0) + signedAmount);
      if (payment.reservation_id) paymentsByReservation.set(payment.reservation_id, (paymentsByReservation.get(payment.reservation_id) ?? 0) + signedAmount);
      if (localPaidDate === today) revenueToday += signedAmount;
      if (localPaidDate >= weekStart && localPaidDate <= today) revenueWeek += signedAmount;
      if (localPaidDate >= monthStart && localPaidDate <= monthEnd) revenueMonth += signedAmount;
    }
  }

  let unpaidBalances = 0;
  for (const contract of activeContracts) {
    const due = contract.final_total_amount ?? Number(contract.base_total_amount ?? contract.total_amount ?? 0) + Number(contract.extras_total ?? 0) + Number(contract.return_charges_total ?? 0);
    unpaidBalances += Math.max(0, Number(due) - (paymentsByContract.get(contract.id) ?? 0));
  }
  const contractReservationIds = new Set(contracts.map((contract) => contract.reservation_id).filter(Boolean));
  for (const reservation of reservations.filter((item) => ["PENDING", "CONFIRMED"].includes(item.status))) {
    const paid = paymentsByReservation.get(reservation.id) ?? 0;
    if (!contractReservationIds.has(reservation.id)) unpaidBalances += Math.max(0, Number(reservation.total_amount) - paid);
  }

  let expensesMonth = 0;
  for (const expense of expensesResult.data ?? []) {
    if (expense.expense_date >= monthStart && expense.expense_date <= monthEnd) expensesMonth += Number(expense.amount);
  }
  for (const item of maintenance) {
    if (item.status === "COMPLETED" && item.service_date >= monthStart && item.service_date <= monthEnd) expensesMonth += Number(item.cost);
  }

  const alerts: DashboardAlert[] = [];
  if (lateReturns.length) {
    alerts.push({
      severity: "critical",
      title: `${lateReturns.length} retour(s) en retard`,
      description: "Vérifiez les contrats et contactez les clients concernés.",
      href: "/agency/reservations",
    });
  }
  if (unpaidBalances > 0) {
    alerts.push({
      severity: "warning",
      title: "Soldes impayés à recouvrer",
      description: `${unpaidBalances.toLocaleString("fr-MA", { style: "currency", currency: "MAD" })} restent à encaisser.`,
      href: "/agency/payments",
    });
  }

  const expiryLimit = addDays(today, 30);
  for (const vehicle of vehicles) {
    const documents = [
      [vehicle.insurance_expiry, "assurance"],
      [vehicle.technical_inspection_expiry, "visite technique"],
    ] as const;
    for (const [expiry, label] of documents) {
      if (!expiry || expiry > expiryLimit) continue;
      const expired = expiry < today;
      alerts.push({
        severity: expired ? "critical" : "warning",
        title: `${expired ? "Document expiré" : "Document bientôt expiré"} : ${label}`,
        description: `${vehicle.brand} ${vehicle.model} · ${vehicle.license_plate} · ${expired ? `depuis le ${expiry}` : `le ${expiry}`}`,
        href: `/agency/fleet/${vehicle.id}`,
      });
    }
  }
  for (const customer of customers) {
    const documents = [
      [customer.id_expiry, "CIN / pièce d’identité"],
      [customer.driver_license_expiry, "permis"],
      [customer.passport_expiry, "passeport"],
    ] as const;
    for (const [expiry, label] of documents) {
      if (!expiry || expiry > expiryLimit) continue;
      const expired = expiry < today;
      alerts.push({
        severity: expired ? "critical" : "warning",
        title: `${expired ? "Document client expiré" : "Document client bientôt expiré"} : ${label}`,
        description: `${customer.first_name} ${customer.last_name} · ${expired ? `depuis le ${expiry}` : `le ${expiry}`}`,
        href: `/agency/customers/${customer.id}`,
      });
    }
  }

  const maintenanceDue = maintenance.filter((item) => item.status === "SCHEDULED" && item.next_service_date && item.next_service_date <= addDays(today, 7));
  if (maintenanceDue.length) {
    alerts.push({
      severity: "warning",
      title: `${maintenanceDue.length} entretien(s) à planifier`,
      description: "Des interventions sont prévues dans les 7 prochains jours.",
      href: "/agency/maintenance",
    });
  }

  const metrics = {
    totalVehicles: fleet.total,
    availableVehicles: fleet.byStatus.AVAILABLE,
    rentedVehicles: fleet.byStatus.RENTED,
    reservedVehicles: fleet.byStatus.RESERVED,
    maintenanceVehicles: fleet.byStatus.MAINTENANCE,
    unavailableVehicles: fleet.byStatus.OUT_OF_SERVICE,
    reservationsToday: reservationsToday.length,
    pickupsToday: pickupsToday.length,
    returnsToday: returnsToday.length,
    lateReturns: lateReturns.length,
    activeRentals: activeContracts.length,
    pendingReservations: pendingReservations.length,
    unpaidBalances,
    depositsHeld: Math.max(0, depositsHeld),
    revenueToday,
    revenueWeek,
    revenueMonth,
    expensesMonth,
    netProfitMonth: revenueMonth - expensesMonth,
    utilizationRate: fleet.total ? Math.round((activeContracts.length / fleet.total) * 100) : 0,
  };

  return { timezone, metrics, alerts: alerts.slice(0, 10) };
}
