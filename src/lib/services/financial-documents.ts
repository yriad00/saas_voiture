import { roundMoney } from "@/lib/utils";

export type FinancialDocumentKind = "INVOICE" | "RECEIPT" | "QUOTE";

/**
 * FleetHub stores rental prices and payments as TTC (gross) MAD amounts.  A
 * financial document therefore keeps the gross amount unchanged and splits it
 * into HT + TVA for display.  This is especially important for receipts:
 * adding TVA to a cash amount that was already received would make a 1,000 MAD
 * payment appear as 1,200 MAD and would disconnect the document from the
 * rental balance.
 */
export function calculateFinancialDocumentTotals(
  financials: { grandTotal: number; paidTotal: number },
  kind: FinancialDocumentKind,
  configuredTaxRate: number,
) {
  const grossAmount = roundMoney(kind === "RECEIPT" ? financials.paidTotal : financials.grandTotal);
  const taxRate = roundMoney(Math.max(0, configuredTaxRate));
  if (taxRate <= 0) {
    return { subtotal: grossAmount, taxRate: 0, taxAmount: 0, totalAmount: grossAmount };
  }

  const subtotal = roundMoney(grossAmount / (1 + taxRate / 100));
  const taxAmount = roundMoney(grossAmount - subtotal);
  return { subtotal, taxRate, taxAmount, totalAmount: grossAmount };
}
