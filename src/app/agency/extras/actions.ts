"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAgency, requireAgencyPermission } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import { logAudit } from "@/lib/services/audit";
import { calculateExtraTotal } from "@/lib/services/extras";
import { roundMoney } from "@/lib/utils";

const catalogSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  branch_id: z.string().uuid().optional().or(z.literal("")),
  pricing_type: z.enum(["PER_DAY", "FLAT", "PER_UNIT"]),
  price: z.coerce.number().min(0),
  min_quantity: z.coerce.number().int().min(1).default(1),
  max_quantity: z.preprocess((v) => v === "" || v == null ? undefined : v, z.coerce.number().int().min(1).optional()),
});
const idSchema = z.string().uuid();
const assignmentSchema = z.object({
  parent_id: z.string().uuid(),
  extra_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
  notes: z.string().trim().max(500).optional(),
});
export type ExtraState = { error?: string; success?: boolean };

function daysBetween(start: string, end: string) { return Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000)); }

export async function createExtra(_prev: ExtraState, formData: FormData): Promise<ExtraState> {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER"]);
  const parsed = catalogSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || (parsed.data.max_quantity !== undefined && parsed.data.max_quantity < parsed.data.min_quantity)) return { error: "Vérifiez les informations de l'extra." };
  const supabase = await createClient();
  if (!(await consumeRateLimit(supabase, "extras.catalog.create", 30, 3600))) return { error: "Trop de modifications d'extras." };
  const d = parsed.data;
  const { data, error } = await supabase.from("extras_catalog").insert({
    agency_id: ctx.membership.agencyId, branch_id: d.branch_id || ctx.membership.branchId || null,
    code: d.code.toUpperCase(), name: d.name, description: d.description || null,
    pricing_type: d.pricing_type, price: roundMoney(d.price), min_quantity: d.min_quantity,
    max_quantity: d.max_quantity ?? null, created_by: ctx.user.id,
  }).select("id").single();
  if (error || !data) return { error: error?.message ?? "Impossible de créer l'extra." };
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, branchId: d.branch_id || ctx.membership.branchId, action: "EXTRA_CREATED", entityType: "extra", entityId: data.id, metadata: { code: d.code } });
  revalidatePath("/agency/extras");
  return { success: true };
}

export async function toggleExtra(extraId: string, active: boolean): Promise<ExtraState> {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER"]);
  if (!idSchema.safeParse(extraId).success) return { error: "Extra invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("extras_catalog").update({ active, updated_at: new Date().toISOString() }).eq("id", extraId).eq("agency_id", ctx.membership.agencyId).select("id, branch_id").maybeSingle();
  if (error || !data) return { error: error?.message ?? "Extra introuvable." };
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, branchId: data.branch_id, action: active ? "EXTRA_ACTIVATED" : "EXTRA_ARCHIVED", entityType: "extra", entityId: extraId, metadata: {} });
  revalidatePath("/agency/extras");
  return { success: true };
}

export async function addReservationExtra(_prev: ExtraState, formData: FormData): Promise<ExtraState> {
  const ctx = await requireAgencyPermission("reservations.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = assignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Extra ou quantité invalide." };
  const d = parsed.data; const supabase = await createClient();
  if (!(await consumeRateLimit(supabase, "extras.reservation.assign", 60, 60))) return { error: "Trop de tentatives." };
  const [{ data: reservation }, { data: extra }] = await Promise.all([
    supabase.from("reservations").select("id, branch_id, start_date, end_date, status").eq("id", d.parent_id).eq("agency_id", ctx.membership.agencyId).maybeSingle(),
    supabase.from("extras_catalog").select("*").eq("id", d.extra_id).eq("agency_id", ctx.membership.agencyId).eq("active", true).maybeSingle(),
  ]);
  if (!reservation || !extra) return { error: "Réservation ou extra introuvable." };
  if (reservation.status === "CANCELLED" || reservation.status === "COMPLETED") return { error: "Cette réservation n'est plus modifiable." };
  if (extra.branch_id && extra.branch_id !== reservation.branch_id) return { error: "Cet extra n'est pas disponible dans cette branche." };
  if (d.quantity < extra.min_quantity || (extra.max_quantity !== null && d.quantity > extra.max_quantity)) return { error: "Quantité hors limites pour cet extra." };
  const total = calculateExtraTotal(extra.pricing_type as "PER_DAY" | "FLAT" | "PER_UNIT", Number(extra.price), d.quantity, daysBetween(reservation.start_date, reservation.end_date));
  const { data, error } = await supabase.from("reservation_extras").insert({ agency_id: ctx.membership.agencyId, branch_id: reservation.branch_id, reservation_id: reservation.id, extra_id: extra.id, code: extra.code, name: extra.name, pricing_type: extra.pricing_type, quantity: d.quantity, unit_price: Number(extra.price), total_amount: total, notes: d.notes || null, created_by: ctx.user.id }).select("id").single();
  if (error || !data) return { error: error?.code === "23505" ? "Cet extra est déjà ajouté." : error?.message ?? "Impossible d'ajouter l'extra." };
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, branchId: reservation.branch_id, action: "RESERVATION_EXTRA_ADDED", entityType: "reservation", entityId: reservation.id, metadata: { extraId: extra.id, quantity: d.quantity, total } });
  revalidatePath(`/agency/reservations/${reservation.id}`); revalidatePath("/agency/reservations");
  return { success: true };
}

export async function removeReservationExtra(extraAssignmentId: string): Promise<ExtraState> {
  const ctx = await requireAgencyPermission("reservations.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]); const supabase = await createClient();
  if (!idSchema.safeParse(extraAssignmentId).success) return { error: "Extra invalide." };
  const { data: row } = await supabase.from("reservation_extras").select("id, reservation_id, branch_id").eq("id", extraAssignmentId).eq("agency_id", ctx.membership.agencyId).maybeSingle();
  if (!row) return { error: "Extra introuvable." };
  const { error } = await supabase.from("reservation_extras").delete().eq("id", extraAssignmentId).eq("agency_id", ctx.membership.agencyId);
  if (error) return { error: error.message };
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, branchId: row.branch_id, action: "RESERVATION_EXTRA_REMOVED", entityType: "reservation", entityId: row.reservation_id, metadata: { assignmentId: extraAssignmentId } });
  revalidatePath(`/agency/reservations/${row.reservation_id}`); return { success: true };
}

export async function addContractExtra(_prev: ExtraState, formData: FormData): Promise<ExtraState> {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]); const parsed = assignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Extra ou quantité invalide." };
  const d = parsed.data; const supabase = await createClient();
  const [{ data: contract }, { data: extra }] = await Promise.all([
    supabase.from("contracts").select("id, branch_id, start_date, end_date, status").eq("id", d.parent_id).eq("agency_id", ctx.membership.agencyId).maybeSingle(),
    supabase.from("extras_catalog").select("*").eq("id", d.extra_id).eq("agency_id", ctx.membership.agencyId).eq("active", true).maybeSingle(),
  ]);
  if (!contract || !extra) return { error: "Contrat ou extra introuvable." };
  if (contract.status === "CLOSED" || contract.status === "CANCELLED") return { error: "Ce contrat est clôturé." };
  if (extra.branch_id && extra.branch_id !== contract.branch_id) return { error: "Cet extra n'est pas disponible dans cette branche." };
  if (d.quantity < extra.min_quantity || (extra.max_quantity !== null && d.quantity > extra.max_quantity)) return { error: "Quantité hors limites pour cet extra." };
  const total = calculateExtraTotal(extra.pricing_type as "PER_DAY" | "FLAT" | "PER_UNIT", Number(extra.price), d.quantity, daysBetween(contract.start_date, contract.end_date));
  const { data, error } = await supabase.from("contract_extras").insert({ agency_id: ctx.membership.agencyId, branch_id: contract.branch_id, contract_id: contract.id, extra_id: extra.id, code: extra.code, name: extra.name, pricing_type: extra.pricing_type, quantity: d.quantity, unit_price: Number(extra.price), total_amount: total, notes: d.notes || null, created_by: ctx.user.id }).select("id").single();
  if (error || !data) return { error: error?.code === "23505" ? "Cet extra est déjà ajouté." : error?.message ?? "Impossible d'ajouter l'extra." };
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, branchId: contract.branch_id, action: "CONTRACT_EXTRA_ADDED", entityType: "contract", entityId: contract.id, metadata: { extraId: extra.id, quantity: d.quantity, total } });
  revalidatePath(`/agency/contracts/${contract.id}`); return { success: true };
}

export async function removeContractExtra(extraAssignmentId: string): Promise<ExtraState> {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]); const supabase = await createClient();
  if (!idSchema.safeParse(extraAssignmentId).success) return { error: "Extra invalide." };
  const { data: row } = await supabase.from("contract_extras").select("id, contract_id, branch_id").eq("id", extraAssignmentId).eq("agency_id", ctx.membership.agencyId).maybeSingle();
  if (!row) return { error: "Extra introuvable." };
  const { error } = await supabase.from("contract_extras").delete().eq("id", extraAssignmentId).eq("agency_id", ctx.membership.agencyId);
  if (error) return { error: error.message };
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, branchId: row.branch_id, action: "CONTRACT_EXTRA_REMOVED", entityType: "contract", entityId: row.contract_id, metadata: { assignmentId: extraAssignmentId } });
  revalidatePath(`/agency/contracts/${row.contract_id}`); return { success: true };
}
