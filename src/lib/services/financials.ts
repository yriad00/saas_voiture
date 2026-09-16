import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { roundMoney } from "@/lib/utils";
import { measurePerf } from "@/lib/perf";

export type ContractFinancialInput = {
  baseTotalAmount: number;
  extrasTotal: number;
  oneWayFee?: number;
  returnChargesTotal?: number;
  earlyReturnAdjustment?: number;
  finalTotalAmount?: number | null;
  payments?: Array<{ amount: number | string; type: string; status: string }>;
  deposit?: {
    requiredAmount: number;
    receivedAmount: number;
    heldAmount: number;
    deductedAmount: number;
    refundedAmount: number;
  } | null;
  /** Portion of the held deposit explicitly applied to rental charges. */
  depositSettlementAmount?: number;
};

/**
 * Single source of truth for a rental's operational totals.  The caution is
 * deliberately excluded from revenue. Explicit deposit deductions can settle
 * the rental balance, but remain separate from collected cash.
 */
export function calculateContractFinancials(input: ContractFinancialInput) {
  const rentalSubtotal = roundMoney(Number(input.baseTotalAmount || 0) + Number(input.extrasTotal || 0) + Number(input.oneWayFee || 0));
  const returnChargesTotal = roundMoney(Number(input.returnChargesTotal || 0));
  const calculatedTotal = roundMoney(rentalSubtotal + returnChargesTotal);
  const adjustedTotal = roundMoney(Math.max(0, calculatedTotal + Number(input.earlyReturnAdjustment || 0)));
  const grandTotal = input.finalTotalAmount === null || input.finalTotalAmount === undefined
    ? adjustedTotal
    : roundMoney(Number(input.finalTotalAmount));
  const completed = (input.payments ?? []).filter((payment) => payment.status === "COMPLETED");
  const rentalPaidTotal = roundMoney(completed
    .filter((payment) => ["RENTAL", "PENALTY", "EXTRA"].includes(payment.type))
    .reduce((sum, payment) => sum + Number(payment.amount), 0));
  const refundTotal = roundMoney(completed
    .filter((payment) => payment.type === "REFUND")
    .reduce((sum, payment) => sum + Number(payment.amount), 0));
  const paidTotal = roundMoney(Math.max(0, rentalPaidTotal - refundTotal));
  const depositSettlementAmount = roundMoney(Math.max(0, Number(input.depositSettlementAmount || 0)));
  const depositRequired = roundMoney(Number(input.deposit?.requiredAmount || 0));
  const depositReceived = roundMoney(Number(input.deposit?.receivedAmount || 0));
  const depositHeld = roundMoney(Number(input.deposit?.heldAmount || 0));
  const depositDeducted = roundMoney(Number(input.deposit?.deductedAmount || 0));
  const depositRefunded = roundMoney(Number(input.deposit?.refundedAmount || 0));
  return {
    rentalSubtotal,
    returnChargesTotal,
    calculatedTotal,
    grandTotal,
    rentalPaidTotal,
    refundTotal,
    paidTotal,
    amountDue: roundMoney(Math.max(0, grandTotal - paidTotal - depositSettlementAmount)),
    depositSettlementAmount,
    depositRequired,
    depositReceived,
    depositHeld,
    depositDeducted,
    depositRefunded,
    depositAvailable: roundMoney(Math.max(0, depositHeld - depositDeducted - depositRefunded)),
  };
}

export async function getContractFinancials(
  supabase: any,
  agencyId: string,
  contractId: string,
  prefetched?: {
    contract?: Record<string, unknown> | null;
    payments?: Array<{ amount: number | string; type: string; status: string }>
      | Promise<Array<{ amount: number | string; type: string; status: string }>>;
    deposit?: Record<string, unknown> | null
      | Promise<Record<string, unknown> | null>;
    depositTransactions?: Array<{ transaction_type: string; amount: number | string; settles_balance?: boolean }>
      | Promise<Array<{ transaction_type: string; amount: number | string; settles_balance?: boolean }>>;
  },
): Promise<ReturnType<typeof calculateContractFinancials> | null> {
  const contractQuery = prefetched && "contract" in prefetched
    ? Promise.resolve({ data: prefetched.contract })
    : measurePerf("contract.financials.contract", async () =>
        supabase.from("contracts").select("base_total_amount,extras_total,one_way_fee,return_charges_total,early_return_adjustment,final_total_amount,total_amount").eq("id", contractId).eq("agency_id", agencyId).maybeSingle(),
      );
  const paymentsQuery = prefetched && "payments" in prefetched
    ? Promise.resolve(prefetched.payments ?? []).then((data) => ({ data }))
    : measurePerf("contract.financials.payments", async () =>
        supabase.from("payments").select("amount,type,status").eq("contract_id", contractId).eq("agency_id", agencyId),
      );
  const depositQuery = prefetched && "deposit" in prefetched
    ? Promise.resolve(prefetched.deposit ?? null).then((data) => ({ data }))
    : measurePerf("contract.financials.deposit", async () =>
        // Include the id so deposit transactions can be filtered by their
        // actual foreign key. PostgREST has no relationship metadata for this
        // legacy table pair, so a nested `deposits!inner(...)` select is not
        // reliable and previously hid deposit settlements from the balance.
        supabase.from("deposits").select("id,required_amount,received_amount,held_amount,deducted_amount,refunded_amount").eq("contract_id", contractId).eq("agency_id", agencyId).maybeSingle(),
      );
  const [{ data: contract }, { data: charges }, { data: financialPayments }, { data: deposit }] = await Promise.all([
    contractQuery,
    measurePerf("contract.financials.returnCharges", async () =>
      supabase.from("return_charges").select("amount").eq("contract_id", contractId).eq("agency_id", agencyId),
    ),
    paymentsQuery,
    depositQuery,
  ]);
  if (!contract) return null;
  const depositTransactionsQuery = prefetched && "depositTransactions" in prefetched
    ? Promise.resolve(prefetched.depositTransactions ?? []).then((data) => ({ data }))
    : deposit && typeof (deposit as Record<string, unknown>).id === "string"
      ? measurePerf("contract.financials.depositTransactions", async () =>
          (supabase as any).from("deposit_transactions").select("transaction_type,amount,settles_balance,deposit_id").eq("agency_id", agencyId).eq("deposit_id", (deposit as Record<string, unknown>).id),
        )
      : Promise.resolve({ data: [] });
  const { data: depositTransactions } = await depositTransactionsQuery;
  const baseTotalAmount = Number(contract.base_total_amount ?? contract.total_amount ?? 0);
  const extrasTotal = Number(contract.extras_total ?? 0);
  const storedReturnCharges = Number(contract.return_charges_total ?? 0);
  const actualReturnCharges = (charges ?? []).reduce((sum: number, row: { amount: number | string }) => sum + Number(row.amount), 0);
  return calculateContractFinancials({
    baseTotalAmount,
    extrasTotal,
    oneWayFee: Number(contract.one_way_fee ?? 0),
    returnChargesTotal: Math.max(storedReturnCharges, actualReturnCharges),
    earlyReturnAdjustment: Number(contract.early_return_adjustment ?? 0),
    finalTotalAmount: contract.final_total_amount,
    payments: financialPayments ?? [],
    deposit: deposit ? {
      requiredAmount: Number(deposit.required_amount),
      receivedAmount: Number(deposit.received_amount),
      heldAmount: Number(deposit.held_amount),
      deductedAmount: Number(deposit.deducted_amount),
      refundedAmount: Number(deposit.refunded_amount),
    } : null,
    depositSettlementAmount: (depositTransactions ?? [])
      .filter((row: { transaction_type: string; settles_balance?: boolean }) => row.transaction_type === "DEDUCTION" && row.settles_balance === true)
      .reduce((sum: number, row: { amount: number | string }) => sum + Number(row.amount), 0),
  });
}
