import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables, Enums } from "@/lib/database.types";
import { getContractFinancials } from "@/lib/services/financials";
import { measurePerf } from "@/lib/perf";

export type ContractRow = Tables<"contracts">;
export type InvoiceRow = Tables<"invoices">;
export type ContractInspectionRow = Tables<"contract_inspections">;
export type ContractPhotoRow = Tables<"contract_inspection_photos">;
export type ContractReturnCharge = {
  id: string;
  branch_id: string | null;
  charge_type: string;
  quantity: number | string;
  unit_price: number | string;
  amount: number | string;
  reason: string;
  source: string;
  created_at: string;
};

export type ContractListItem = ContractRow & {
  customerName: string;
  vehicleLabel: string;
};

export async function listContracts(agencyId: string): Promise<ContractListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("*, customers!contracts_customer_id_fkey!inner(first_name, last_name), vehicles!inner(brand, model, license_plate)")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((c) => {
    const cust = c.customers as unknown as { first_name: string; last_name: string };
    const v = c.vehicles as unknown as { brand: string; model: string; license_plate: string };
    return {
      ...(c as ContractRow),
      customerName: `${cust.first_name} ${cust.last_name}`,
      vehicleLabel: `${v.brand} ${v.model} (${v.license_plate})`,
    };
  });
}

export type ContractDetail = ContractRow & {
  customer: { id: string; name: string; phone: string | null; whatsapp: string | null; email: string | null; id_type: string | null; id_number: string | null; driver_license_number: string | null; driver_license_expiry: string | null; passport_expiry: string | null; nationality: string | null };
  vehicle: { id: string; label: string; plate: string; year: number | null; category: string | null; fuel_type: string | null; transmission: string | null; ownership_type?: string | null; owner_name?: string | null; owner_phone?: string | null; owner_cost_per_day?: number | null };
  reservationRef: string | null;
  pickupLocation: string | null;
  returnLocation: string | null;
  payments: Array<Tables<"payments">>;
  invoices: InvoiceRow[];
  inspections: ContractInspectionRow[];
  photos: Array<ContractPhotoRow & { signedUrl: string | null }>;
  returnCharges: ContractReturnCharge[];
  deposit: { id: string; branch_id: string | null; required_amount: number; received_amount: number; held_amount: number; deducted_amount: number; refunded_amount: number; status: string; payment_method?: string | null; cheque_status?: string | null } | null;
  paidTotal: number;
  rentalPaidTotal: number;
  depositCollected: number;
  refundTotal: number;
  financials: NonNullable<Awaited<ReturnType<typeof getContractFinancials>>>;
};

export type ContractCritical = ContractRow & {
  customer: ContractDetail["customer"];
  vehicle: ContractDetail["vehicle"];
  reservationRef: string | null;
  pickupLocation: string | null;
  returnLocation: string | null;
  deposit: ContractDetail["deposit"];
  financials: ContractDetail["financials"];
  depositCollected: number;
  refundTotal: number;
  preparation: Record<string, unknown> | null;
  checkout: Record<string, unknown> | null;
  checkin: Record<string, unknown> | null;
};

/**
 * Loads only the data needed to render the top of a rental dossier.  History,
 * signed photos, invoices and operational panels stay in getContract and are
 * fetched by the deferred secondary section.
 */
export async function getContractCritical(id: string, agencyId: string): Promise<ContractCritical | null> {
  const supabase = await createClient();
  const { data } = await measurePerf("contract.critical.primary", async () => supabase
    .from("contracts")
    .select("*, customers!contracts_customer_id_fkey!inner(id, first_name, last_name, phone, whatsapp, email, id_type, id_number, driver_license_number, driver_license_expiry, passport_expiry, nationality), vehicles!inner(id, brand, model, license_plate, year, category, fuel_type, transmission, ownership_type, owner_name, owner_phone, owner_cost_per_day), reservations(reference, pickup_location, return_location)")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle());
  if (!data) return null;

  const c = data.customers as unknown as ContractDetail["customer"] & { first_name?: string; last_name?: string };
  const v = data.vehicles as unknown as ContractDetail["vehicle"] & { brand?: string; model?: string; license_plate?: string };
  const resv = data.reservations as unknown as { reference: string; pickup_location: string | null; return_location: string | null } | null;
  const paymentsQuery = measurePerf("contract.critical.payments", async () => supabase.from("payments").select("amount,type,status").eq("contract_id", id).eq("agency_id", agencyId));
  const depositQuery = measurePerf("contract.critical.deposit", async () => {
    // Compatibility cast for tables not yet present in generated database types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (supabase as any).from("deposits").select("id,branch_id,required_amount,received_amount,held_amount,deducted_amount,refunded_amount,status,payment_method,cheque_status").eq("contract_id", id).eq("agency_id", agencyId).maybeSingle();
  });
  const chargesQuery = measurePerf("contract.critical.returnCharges", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (supabase as any).from("return_charges").select("amount").eq("contract_id", id).eq("agency_id", agencyId);
  });
  const preparationQuery = measurePerf("contract.critical.preparation", async () => supabase.from("vehicle_preparations").select("status").eq("contract_id", id).eq("agency_id", agencyId).maybeSingle());
  const checkoutQuery = measurePerf("contract.critical.checkout", async () => supabase.from("contract_checkouts").select("id,checkout_at,mileage,fuel_level").eq("contract_id", id).eq("agency_id", agencyId).maybeSingle());
  const checkinQuery = measurePerf("contract.critical.checkin", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (supabase as any).from("contract_checkins").select("id,status,actual_return_at,return_mileage,fuel_level").eq("contract_id", id).eq("agency_id", agencyId).maybeSingle();
  });
  const [{ data: payments }, { data: deposit }, { data: charges }, { data: preparation }, { data: checkout }, { data: checkin }] = await Promise.all([paymentsQuery, depositQuery, chargesQuery, preparationQuery, checkoutQuery, checkinQuery]);
  type DepositTransactionRow = { transaction_type: string; amount: number | string; settles_balance?: boolean; deposit_id?: string };
  const depositTransactions: DepositTransactionRow[] = deposit?.id
    ? await measurePerf<{ data: DepositTransactionRow[] | null }>("contract.critical.depositTransactions", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (supabase as any).from("deposit_transactions").select("transaction_type,amount,settles_balance,deposit_id").eq("agency_id", agencyId).eq("deposit_id", deposit.id);
      }).then((result) => result.data ?? [])
    : [];
  const financials = await measurePerf("contract.critical.financials", () => getContractFinancials(supabase, agencyId, id, {
    contract: data as unknown as Record<string, unknown>,
    payments: (payments ?? []) as Array<{ amount: number | string; type: string; status: string }>,
    deposit: (deposit ?? null) as Record<string, unknown> | null,
    depositTransactions,
    returnCharges: (charges ?? []) as Array<{ amount: number | string }>,
  }));
  const fallback = {
    rentalSubtotal: Number(data.total_amount), returnChargesTotal: 0, calculatedTotal: Number(data.total_amount), grandTotal: Number(data.total_amount),
    rentalPaidTotal: 0, refundTotal: 0, paidTotal: 0, amountDue: Number(data.total_amount), depositSettlementAmount: 0,
    depositRequired: 0, depositReceived: 0, depositHeld: 0, depositDeducted: 0, depositRefunded: 0, depositAvailable: 0,
  };
  const totals = financials ?? fallback;
  return {
    ...(data as ContractRow),
    customer: { id: c.id, name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(), phone: c.phone ?? null, whatsapp: c.whatsapp ?? null, email: c.email ?? null, id_type: c.id_type ?? null, id_number: c.id_number ?? null, driver_license_number: c.driver_license_number ?? null, driver_license_expiry: c.driver_license_expiry ?? null, passport_expiry: c.passport_expiry ?? null, nationality: c.nationality ?? null },
    vehicle: { id: v.id, label: `${v.brand ?? ""} ${v.model ?? ""}`.trim(), plate: v.license_plate ?? "", year: v.year ?? null, category: v.category ?? null, fuel_type: v.fuel_type ?? null, transmission: v.transmission ?? null, ownership_type: v.ownership_type ?? null, owner_name: v.owner_name ?? null, owner_phone: v.owner_phone ?? null, owner_cost_per_day: v.owner_cost_per_day ?? null },
    reservationRef: resv?.reference ?? null,
    pickupLocation: resv?.pickup_location ?? null,
    returnLocation: resv?.return_location ?? null,
    deposit: (deposit ?? null) as ContractDetail["deposit"],
    financials: totals,
    depositCollected: totals.depositAvailable,
    refundTotal: totals.refundTotal,
    preparation: (preparation ?? null) as Record<string, unknown> | null,
    checkout: (checkout ?? null) as Record<string, unknown> | null,
    checkin: (checkin ?? null) as Record<string, unknown> | null,
  };
}

export async function getContract(id: string, agencyId: string): Promise<ContractDetail | null> {
  const supabase = await createClient();
  const { data } = await measurePerf("contract.primary", async () =>
    supabase
      .from("contracts")
      .select("*, customers!contracts_customer_id_fkey!inner(id, first_name, last_name, phone, whatsapp, email, id_type, id_number, driver_license_number, driver_license_expiry, passport_expiry, nationality), vehicles!inner(id, brand, model, license_plate, year, category, fuel_type, transmission, ownership_type, owner_name, owner_phone, owner_cost_per_day), reservations(reference, pickup_location, return_location)")
      .eq("id", id)
      .eq("agency_id", agencyId)
      .maybeSingle(),
  );
  if (!data) return null;

  const c = data.customers as unknown as { id: string; first_name: string; last_name: string; phone: string | null; whatsapp: string | null; email: string | null; id_type: string | null; id_number: string | null; driver_license_number: string | null; driver_license_expiry: string | null; passport_expiry: string | null; nationality: string | null };
  const v = data.vehicles as unknown as { id: string; brand: string; model: string; license_plate: string; year: number | null; category: string | null; fuel_type: string | null; transmission: string | null; ownership_type?: string | null; owner_name?: string | null; owner_phone?: string | null; owner_cost_per_day?: number | null };
  const resv = data.reservations as unknown as { reference: string; pickup_location: string | null; return_location: string | null } | null;

  // Financial and inspection panels are independent. Fetch them together so
  // the dossier has one network latency instead of four sequential waits.
  const paymentsQuery = measurePerf("contract.payments", async () =>
    supabase
      .from("payments")
      .select("*")
      .eq("contract_id", id)
      .order("paid_at", { ascending: false }),
  );
  const paymentRows = paymentsQuery.then(({ data: paymentData }) =>
    (paymentData ?? []) as Array<{ amount: number | string; type: string; status: string }>,
  );
  const depositQuery = measurePerf("contract.deposit", async () =>
    // The generated schema types predate the deposits table; this is kept as
    // a narrow compatibility cast until the next database type regeneration.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("deposits")
      .select("id,branch_id,required_amount,received_amount,held_amount,deducted_amount,refunded_amount,status,payment_method,cheque_status")
      .eq("contract_id", id)
      .eq("agency_id", agencyId)
      .maybeSingle(),
  );
  const depositRow = depositQuery.then(({ data: depositData }) =>
    depositData as ContractDetail["deposit"],
  );
  const returnChargesQuery = measurePerf("contract.returnCharges", async () =>
    // Generated database types predate this legacy table; keep the cast narrow.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("return_charges")
      .select("id,branch_id,charge_type,quantity,unit_price,amount,reason,source,created_at")
      .eq("contract_id", id)
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false }),
  );
  const returnChargesRows = returnChargesQuery.then(({ data: chargeData }) =>
    (chargeData ?? []) as unknown as ContractReturnCharge[],
  );
  const financialsQuery = measurePerf("contract.financials", () => getContractFinancials(supabase, agencyId, id, {
    contract: data as unknown as Record<string, unknown>,
    payments: paymentRows,
    deposit: depositRow as Promise<Record<string, unknown> | null>,
    returnCharges: returnChargesRows,
  }));
  const [
    { data: payments },
    { data: invoices },
    { data: inspections },
    { data: photos },
    { data: deposit },
    { data: returnCharges },
    financials,
  ] = await Promise.all([
    paymentsQuery,
    measurePerf("contract.invoices", async () =>
      supabase
        .from("invoices")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("contract_id", id)
        .order("issued_at", { ascending: false }),
    ),
    measurePerf("contract.inspections", async () =>
      supabase
        .from("contract_inspections")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("contract_id", id)
        .order("inspected_at", { ascending: false }),
    ),
    measurePerf("contract.photos", async () =>
      supabase
        .from("contract_inspection_photos")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("contract_id", id)
        .order("created_at", { ascending: false }),
    ),
    depositQuery,
    returnChargesQuery,
    // Reuse the primary contract row and payment query above. The financial
    // service still fetches its own charges/deposit under the same RLS scope.
    financialsQuery,
  ]);
  const photosWithUrls = await measurePerf("contract.photoSignedUrls", () => Promise.all((photos ?? []).map(async (photo) => {
    const { data: signed } = await supabase.storage.from("contract-photos").createSignedUrl(photo.storage_path, 3600);
    return { ...(photo as ContractPhotoRow), signedUrl: signed?.signedUrl ?? null };
  })));

  const fallback = {
    rentalSubtotal: Number(data.total_amount), returnChargesTotal: 0,
    calculatedTotal: Number(data.total_amount), grandTotal: Number(data.total_amount),
    rentalPaidTotal: 0, refundTotal: 0, paidTotal: 0, amountDue: Number(data.total_amount), depositSettlementAmount: 0,
    depositRequired: 0, depositReceived: 0, depositHeld: 0, depositDeducted: 0, depositRefunded: 0, depositAvailable: 0,
  };
  const totals = financials ?? fallback;

  return {
    ...(data as ContractRow),
    customer: { id: c.id, name: `${c.first_name} ${c.last_name}`, phone: c.phone, whatsapp: c.whatsapp, email: c.email, id_type: c.id_type, id_number: c.id_number, driver_license_number: c.driver_license_number, driver_license_expiry: c.driver_license_expiry, passport_expiry: c.passport_expiry, nationality: c.nationality },
    vehicle: { id: v.id, label: `${v.brand} ${v.model}`, plate: v.license_plate, year: v.year, category: v.category, fuel_type: v.fuel_type, transmission: v.transmission, ownership_type: v.ownership_type, owner_name: v.owner_name, owner_phone: v.owner_phone, owner_cost_per_day: v.owner_cost_per_day },
    reservationRef: resv?.reference ?? null,
    pickupLocation: resv?.pickup_location ?? null,
    returnLocation: resv?.return_location ?? null,
    payments: payments ?? [],
    invoices: invoices ?? [],
    inspections: inspections ?? [],
    photos: photosWithUrls,
    returnCharges: (returnCharges ?? []) as unknown as ContractReturnCharge[],
    deposit: deposit ?? null,
    paidTotal: totals.paidTotal,
    rentalPaidTotal: totals.rentalPaidTotal,
    // The operational summary must show the amount still physically held.
    // `held_amount` is the gross amount received and remains unchanged after
    // a deduction/refund; the available balance is the actual outstanding
    // caution balance shown to staff.
    depositCollected: totals.depositAvailable,
    refundTotal: totals.refundTotal,
    financials: totals,
  };
}

export type ContractStats = {
  total: number;
  byStatus: Record<Enums<"contract_status">, number>;
};

export function computeContractStats(rows: Array<Pick<ContractRow, "status">>): ContractStats {
  const byStatus: Record<Enums<"contract_status">, number> = { DRAFT: 0, ACTIVE: 0, CLOSED: 0, CANCELLED: 0 };
  for (const c of rows) byStatus[c.status]++;
  return { total: rows.length, byStatus };
}

export async function getContractStats(agencyId: string): Promise<ContractStats> {
  const supabase = await createClient();
  const { data } = await supabase.from("contracts").select("status").eq("agency_id", agencyId);
  return computeContractStats(data ?? []);
}

export async function nextContractNumber(agencyId: string): Promise<string> {
  void agencyId;
  const year = new Date().getFullYear();
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `CTR-${year}-${suffix}`;
}
