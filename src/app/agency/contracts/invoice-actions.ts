"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { requireAgencyPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { roundMoney } from "@/lib/utils";
import { calculateFinancialDocumentTotals } from "@/lib/services/financial-documents";
import { logAudit } from "@/lib/services/audit";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import { getContractFinancials } from "@/lib/services/financials";
import { z } from "zod";

const voidInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  reason: z.string().trim().min(4).max(500),
});

export async function issueInvoice(contractId: string) {
  const ctx = await requireAgencyPermission("invoices.create", ["AGENCY_OWNER", "MANAGER", "ACCOUNTANT"]);
  const supabase = await createClient();
  const agencyId = ctx.membership.agencyId;
  if (!(await consumeRateLimit(supabase, "invoices.issue", 30, 60))) {
    return { error: "Trop de demandes de facturation. Réessayez dans une minute." };
  }

  const { data: existing } = await supabase
    .from("invoices")
    .select("id,total_amount,tax_amount,subtotal,snapshot,document_key")
    .eq("agency_id", agencyId)
    .eq("contract_id", contractId)
    .eq("kind", "INVOICE")
    .eq("status", "ISSUED")
    .limit(1)
    .maybeSingle();
  const [{ data: contract }, { data: agency }, { data: settings }] = await Promise.all([
    supabase
      .from("contracts")
      .select("id, contract_number, status, total_amount, daily_rate, start_date, end_date, customers!contracts_customer_id_fkey!inner(first_name, last_name, address), reservations(reference)")
      .eq("id", contractId)
      .eq("agency_id", agencyId)
      .maybeSingle(),
    supabase
      .from("agencies")
      .select("name, address, city, country, email, phone, currency")
      .eq("id", agencyId)
      .maybeSingle(),
    supabase
      .from("agency_settings")
      .select("tax_rate, extra")
      .eq("agency_id", agencyId)
      .maybeSingle(),
  ]);

  if (!contract || !agency) return { error: "Contrat ou agence introuvable." };
  if (["DRAFT", "CANCELLED"].includes(contract.status)) {
    return { error: "Une facture ne peut être émise que pour un contrat activé ou clôturé." };
  }
  const customer = contract.customers as unknown as {
    first_name: string;
    last_name: string;
    address: string | null;
  };
  const reservation = contract.reservations as unknown as { reference: string } | null;
  const extra = (settings?.extra ?? {}) as Record<string, unknown>;
  const financials = await getContractFinancials(supabase, agencyId, contractId);
  if (!financials) return { error: "Totaux du contrat introuvables." };
  const { subtotal, taxRate, taxAmount, totalAmount } = calculateFinancialDocumentTotals(financials, "INVOICE", Number(settings?.tax_rate ?? 0));
  if (existing) {
    const existingTotal = roundMoney(Number(existing.total_amount));
    const existingSubtotal = roundMoney(Number(existing.subtotal));
    const existingTax = roundMoney(Number(existing.tax_amount));
    if (existingTotal === totalAmount && existingSubtotal === subtotal && existingTax === taxAmount) {
      return { ok: true, id: existing.id };
    }
    return { error: "Une facture a déjà été émise avec un ancien total. Annulez cette facture avant d’en émettre une corrigée." };
  }
  const year = new Date().getFullYear();
  const invoiceNumber = "FAC-" + year + "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      agency_id: agencyId,
      contract_id: contractId,
      document_key: `invoice:${contractId}`,
      invoice_number: invoiceNumber,
      kind: "INVOICE",
      status: "ISSUED",
      seller_name: agency.name,
      seller_address: [agency.address, agency.city, agency.country].filter(Boolean).join(", ") || null,
      seller_if: typeof extra.tax_id === "string" ? extra.tax_id : null,
      seller_tp: typeof extra.professional_tax_id === "string" ? extra.professional_tax_id : null,
      seller_rc: typeof extra.rc_number === "string" ? extra.rc_number : null,
      seller_ice: typeof extra.ice === "string" ? extra.ice : null,
      buyer_name: customer.first_name + " " + customer.last_name,
      buyer_address: customer.address,
      currency: agency.currency || "MAD",
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      notes: ["Contrat " + contract.contract_number, typeof extra.invoice_footer === "string" ? extra.invoice_footer : null].filter(Boolean).join("\n"),
      snapshot: {
        contract_number: contract.contract_number,
        daily_rate: Number(contract.daily_rate),
        start_date: contract.start_date,
        end_date: contract.end_date,
        reservation_reference: reservation?.reference ?? null,
        return_charges_total: financials.returnChargesTotal,
        rental_subtotal: financials.rentalSubtotal,
        grand_total: financials.grandTotal,
        paid_total: financials.paidTotal,
        amount_due: financials.amountDue,
        seller: agency.name,
        buyer: customer.first_name + " " + customer.last_name,
      },
      created_by: ctx.user.id,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const { data: concurrent } = await supabase
      .from("invoices")
      .select("id,total_amount")
      .eq("agency_id", agencyId)
      .eq("contract_id", contractId)
      .eq("kind", "INVOICE")
      .eq("status", "ISSUED")
      .limit(1)
      .maybeSingle();
    if (concurrent) {
      const concurrentTotal = roundMoney(Number(concurrent.total_amount));
      if (concurrentTotal === totalAmount) return { ok: true, id: concurrent.id };
    }
  }
  if (error || !invoice) return { error: error?.message ?? "Impossible d'émettre la facture." };
  await logAudit(supabase, {
    agencyId,
    actorId: ctx.user.id,
    action: "INVOICE_ISSUED",
    entityType: "invoice",
    entityId: invoice.id,
    metadata: { contractId, invoiceNumber, totalAmount },
  });
  revalidatePath("/agency/contracts/" + contractId);
  return { ok: true, id: invoice.id };
}

export async function issueFinancialDocument(contractId: string, kind: "RECEIPT" | "QUOTE") {
  const ctx = await requireAgencyPermission("invoices.create", ["AGENCY_OWNER", "MANAGER", "ACCOUNTANT"]);
  const supabase = await createClient();
  const agencyId = ctx.membership.agencyId;
  if (!(await consumeRateLimit(supabase, "invoices.issue", 30, 60))) return { error: "Trop de demandes de facturation. Réessayez plus tard." };
  const [{ data: contract }, { data: agency }, { data: settings }] = await Promise.all([
    (supabase as any).from("contracts").select("id,contract_number,status,total_amount,daily_rate,start_date,end_date,branch_id,customers!contracts_customer_id_fkey!inner(first_name,last_name,address,id_number),reservations(reference)").eq("id", contractId).eq("agency_id", agencyId).maybeSingle(),
    supabase.from("agencies").select("name,address,city,country,email,phone,currency").eq("id", agencyId).maybeSingle(),
    supabase.from("agency_settings").select("tax_rate,extra").eq("agency_id", agencyId).maybeSingle(),
  ]);
  if (!contract || !agency) return { error: "Contrat ou agence introuvable." };
  if (kind === "RECEIPT" && contract.status === "DRAFT") return { error: "Un reçu nécessite un contrat activé." };
  const customer = contract.customers as { first_name: string; last_name: string; address: string | null; id_number: string | null };
  const reservation = contract.reservations as { reference: string } | null;
  const extra = (settings?.extra ?? {}) as Record<string, unknown>;
  const financials = await getContractFinancials(supabase, agencyId, contractId);
  if (!financials) return { error: "Totaux du contrat introuvables." };
  const paidTotal = roundMoney(financials.paidTotal);
  if (kind === "RECEIPT" && paidTotal <= 0) return { error: "Aucun paiement confirmé à justifier par un reçu." };
  const { subtotal, taxRate, taxAmount, totalAmount } = calculateFinancialDocumentTotals(financials, kind, Number(settings?.tax_rate ?? 0));
  const documentKey = kind === "RECEIPT" ? `receipt:${contractId}:${paidTotal}:${taxRate}` : null;
  if (kind === "RECEIPT") {
    const { data: existingReceipt } = await (supabase as any)
      .from("invoices")
      .select("id,total_amount,snapshot,document_key")
      .eq("agency_id", agencyId)
      .eq("contract_id", contractId)
      .eq("kind", "RECEIPT")
      .eq("status", "ISSUED")
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const existingPaid = existingReceipt?.snapshot && typeof existingReceipt.snapshot === "object"
      ? Number((existingReceipt.snapshot as Record<string, unknown>).paid_total)
      : NaN;
    if (existingReceipt && ((Number.isFinite(existingPaid) && roundMoney(existingPaid) === paidTotal) || (!Number.isFinite(existingPaid) && roundMoney(Number(existingReceipt.total_amount)) === totalAmount))) {
      return { ok: true, id: existingReceipt.id };
    }
  }
  const prefix = kind === "QUOTE" ? "DEV" : "REC";
  const number = `${prefix}-${new Date().getFullYear()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const { data: document, error } = await (supabase as any).from("invoices").insert({ agency_id: agencyId, branch_id: contract.branch_id ?? ctx.membership.branchId ?? null, contract_id: contractId, document_key: documentKey, invoice_number: number, kind, status: "ISSUED", seller_name: agency.name, seller_address: [agency.address, agency.city, agency.country].filter(Boolean).join(", ") || null, seller_if: typeof extra.tax_id === "string" ? extra.tax_id : null, seller_tp: typeof extra.professional_tax_id === "string" ? extra.professional_tax_id : null, seller_ice: typeof extra.ice === "string" ? extra.ice : null, seller_rc: typeof extra.rc_number === "string" ? extra.rc_number : null, buyer_name: `${customer.first_name} ${customer.last_name}`, buyer_address: customer.address, currency: agency.currency || "MAD", subtotal, tax_rate: taxRate, tax_amount: taxAmount, total_amount: totalAmount, notes: `${kind === "QUOTE" ? "Devis" : "Reçu"} · contrat ${contract.contract_number}`, snapshot: { contract_number: contract.contract_number, reservation_reference: reservation?.reference ?? null, id_number: customer.id_number, daily_rate: Number(contract.daily_rate), start_date: contract.start_date, end_date: contract.end_date, return_charges_total: financials.returnChargesTotal, rental_subtotal: financials.rentalSubtotal, grand_total: financials.grandTotal, paid_total: financials.paidTotal, amount_due: financials.amountDue }, created_by: ctx.user.id }).select("id").single();
  if (error?.code === "23505" && documentKey) {
    const { data: concurrent } = await (supabase as any).from("invoices").select("id").eq("agency_id", agencyId).eq("document_key", documentKey).eq("status", "ISSUED").maybeSingle();
    if (concurrent) return { ok: true, id: concurrent.id };
  }
  if (error || !document) return { error: error?.message ?? "Impossible de générer le document." };
  await logAudit(supabase, { agencyId, actorId: ctx.user.id, branchId: contract.branch_id, action: `${kind}_ISSUED`, entityType: "invoice", entityId: document.id, metadata: { contractId, number } });
  revalidatePath(`/agency/contracts/${contractId}`);
  return { ok: true, id: document.id };
}

/**
 * Issued documents are immutable financial history. Voiding is the explicit
 * correction step that allows a corrected invoice to be issued later without
 * rewriting the original amount or snapshot.
 */
export async function voidInvoice(invoiceId: string, reason: string) {
  const ctx = await requireAgencyPermission("invoices.create", ["AGENCY_OWNER", "MANAGER", "ACCOUNTANT"]);
  const parsed = voidInvoiceSchema.safeParse({ invoiceId, reason });
  if (!parsed.success) return { error: "Motif d’annulation invalide." };
  const supabase = await createClient();
  const agencyId = ctx.membership.agencyId;
  const { data: current } = await (supabase as any)
    .from("invoices")
    .select("id,contract_id,branch_id,status,invoice_number,notes,total_amount")
    .eq("id", parsed.data.invoiceId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!current) return { error: "Document introuvable." };
  if (current.status === "VOID") return { ok: true, id: current.id };
  if (current.status !== "ISSUED") return { error: "Seuls les documents émis peuvent être annulés." };
  const notes = [current.notes, `Annulé le ${new Date().toISOString()} : ${parsed.data.reason}`].filter(Boolean).join("\n");
  const { data: updated, error } = await (supabase as any)
    .from("invoices")
    .update({ status: "VOID", notes })
    .eq("id", current.id)
    .eq("agency_id", agencyId)
    .eq("status", "ISSUED")
    .select("id")
    .maybeSingle();
  if (error) return { error: "Impossible d’annuler le document." };
  if (!updated) return { error: "Le document a déjà été modifié. Rechargez la page." };
  await logAudit(supabase, {
    agencyId,
    branchId: current.branch_id,
    actorId: ctx.user.id,
    action: "INVOICE_VOIDED",
    entityType: "invoice",
    entityId: current.id,
    metadata: { contractId: current.contract_id, invoiceNumber: current.invoice_number, amount: current.total_amount, reason: parsed.data.reason },
  });
  revalidatePath(`/agency/contracts/${current.contract_id}`);
  revalidatePath(`/agency/contracts/${current.contract_id}/invoice/${current.id}`);
  return { ok: true, id: current.id };
}
